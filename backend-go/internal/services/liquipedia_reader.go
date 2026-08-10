package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

// MatchStatus is the lifecycle phase of a match as exposed by the API layer.
// It maps to one of the three poller-maintained Redis caches.
type MatchStatus string

const (
	MatchStatusRunning  MatchStatus = "running"
	MatchStatusUpcoming MatchStatus = "upcoming"
	MatchStatusPast     MatchStatus = "past"
)

// ErrUnknownGame is returned when a game acronym cannot be mapped to a
// Liquipedia wiki. Callers should treat this as a soft error (skip + log)
// rather than a fatal condition, since it indicates stale or invalid data
// rather than a transient infrastructure problem.
var ErrUnknownGame = errors.New("unknown game acronym")

// MatchesByStatus returns the normalized matches cached by the poller for the
// given game and status. It reads from Redis only — the API is never called
// here because the poller keeps these three caches warm at fixed intervals.
//
// Returns an empty (non-nil) slice when the cache is empty, so callers can
// treat the result as a list without nil checks.
func (s *LiquipediaService) MatchesByStatus(ctx context.Context, gameAcronym string, status MatchStatus) ([]models.NormalizedMatch, error) {
	wiki, err := s.wikiForAcronym(gameAcronym)
	if err != nil {
		return nil, err
	}

	key, statusHint, err := pollerCacheKey(wiki, status)
	if err != nil {
		return nil, err
	}

	data, err := s.cache.Get(ctx, key)
	if err != nil || data == "" {
		// Le TTL du cache poller expire avant son refresh réel quand les webhooks
		// sont actifs (filet de sécurité à 3× l'intervalle). Sans ce repli, un wiki
		// sans trafic webhook rendrait une liste vide des dizaines de minutes par
		// heure — et les abonnements en dépendent.
		data, err = s.cache.Get(ctx, cache.StaleKey(key))
		if err != nil || data == "" {
			return []models.NormalizedMatch{}, nil
		}
	}

	return parseAndNormalizeMatches([]byte(data), wiki, statusHint), nil
}

// TournamentMatches returns every match belonging to the given tournament,
// identified by its numeric Liquipedia pageid. The lookup is a two-step
// cache-aside:
//
//  1. Resolve the tournament's pagename from its pageid (cached under
//     LiqTournamentKey, populated on-demand by GET /tournaments/:id)
//  2. Fetch the matches whose [[parent::pagename]] matches the tournament
//     (cached under LiqTournamentMatchesKey)
//
// Both steps go through LiquipediaService.MakeRequest, which transparently
// reuses cached responses and respects the per-wiki request budget.
func (s *LiquipediaService) TournamentMatches(ctx context.Context, gameAcronym string, tournamentID int64) ([]models.NormalizedMatch, error) {
	wiki, err := s.wikiForAcronym(gameAcronym)
	if err != nil {
		return nil, err
	}

	pageName, err := s.fetchTournamentPageName(ctx, wiki, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("resolving tournament %d pagename: %w", tournamentID, err)
	}
	if pageName == "" {
		return []models.NormalizedMatch{}, nil
	}

	cacheKey := cache.LiqTournamentMatchesKey(wiki, pageName)
	params := url.Values{}
	params.Set("conditions", fmt.Sprintf("[[parent::%s]]", pageName))
	params.Set("order", "date ASC")
	params.Set("limit", "5000")
	params.Set("query", LiqMatchQueryFields)

	data, err := s.MakeRequest(ctx, wiki, "match", params, cacheKey, TTLTournamentDetail)
	if err != nil {
		return nil, fmt.Errorf("fetching matches for tournament %s: %w", pageName, err)
	}
	return parseAndNormalizeMatches(data, wiki, ""), nil
}

// wikiForAcronym maps an internal game acronym (e.g. "valorant", "csgo") to
// the Liquipedia wiki name used in API requests. Returns ErrUnknownGame if
// the acronym is not registered in models.GameWikiMapping.
func (s *LiquipediaService) wikiForAcronym(gameAcronym string) (string, error) {
	wiki, ok := models.ResolveWiki(gameAcronym)
	if !ok {
		return "", fmt.Errorf("%w: %q", ErrUnknownGame, gameAcronym)
	}
	return wiki, nil
}

// fetchTournamentPageName resolves the Liquipedia pagename of a tournament
// from its numeric pageid. The response is cached under LiqTournamentKey, so
// subsequent calls within TTLTournamentDetail are free.
func (s *LiquipediaService) fetchTournamentPageName(ctx context.Context, wiki string, tournamentID int64) (string, error) {
	idStr := fmt.Sprintf("%d", tournamentID)
	cacheKey := cache.LiqTournamentKey(wiki, idStr)

	params := url.Values{}
	params.Set("conditions", fmt.Sprintf("[[pageid::%d]]", tournamentID))
	params.Set("limit", "1")

	data, err := s.MakeRequest(ctx, wiki, "tournament", params, cacheKey, TTLTournamentDetail)
	if err != nil {
		return "", err
	}

	resp, err := ParseResponse(data)
	if err != nil || len(resp.Result) == 0 {
		return "", nil
	}

	var liqT models.LiqTournament
	if err := json.Unmarshal(resp.Result[0], &liqT); err != nil {
		return "", fmt.Errorf("decoding tournament payload: %w", err)
	}
	return liqT.PageName, nil
}

// pollerCacheKey returns the Redis key and statusHint for a given match
// status. The statusHint is propagated to NormalizeLiqMatch so the frontend
// receives a consistent status string regardless of which cache served the
// data.
func pollerCacheKey(wiki string, status MatchStatus) (key, statusHint string, err error) {
	switch status {
	case MatchStatusRunning:
		return cache.LiqMatchesRunningKey(wiki), "running", nil
	case MatchStatusUpcoming:
		return cache.LiqMatchesUpcomingKey(wiki), "not_started", nil
	case MatchStatusPast:
		return cache.LiqMatchesPastKey(wiki), "finished", nil
	default:
		return "", "", fmt.Errorf("invalid match status: %q", status)
	}
}

// parseAndNormalizeMatches converts a raw Liquipedia /match response body
// into a deduplicated slice of normalized matches. Malformed entries are
// silently skipped; a malformed envelope yields an empty slice rather than
// an error so callers can treat partial cache hits gracefully.
func parseAndNormalizeMatches(data []byte, wiki, statusHint string) []models.NormalizedMatch {
	resp, err := ParseResponse(data)
	if err != nil {
		return []models.NormalizedMatch{}
	}

	matches := make([]models.NormalizedMatch, 0, len(resp.Result))
	seen := make(map[string]bool, len(resp.Result))
	for _, raw := range resp.Result {
		var m models.LiqMatch
		if err := json.Unmarshal(raw, &m); err != nil {
			continue
		}
		key := m.UniqueKey()
		if seen[key] {
			continue
		}
		seen[key] = true
		matches = append(matches, models.NormalizeLiqMatch(m, wiki, statusHint))
	}
	return matches
}
