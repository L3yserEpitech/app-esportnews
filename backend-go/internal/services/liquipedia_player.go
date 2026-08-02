package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

// ErrPlayerNotFound is returned when Liquipedia has no player for the pagename.
var ErrPlayerNotFound = errors.New("player not found")

// GetPlayerByPagename fetches a player profile + transfer history for a wiki.
// Cache-aside via MakeRequest; transfer failures degrade to an empty history.
func (s *LiquipediaService) GetPlayerByPagename(ctx context.Context, wiki, pagename string) (*models.NormalizedPlayerDetail, error) {
	player, err := s.fetchPlayerRecord(ctx, wiki, pagename)
	if errors.Is(err, ErrPlayerNotFound) {
		// MediaWiki capitalizes the first letter of pagenames — heal lowercase
		// slugs coming from older roster payloads ("derke" → "Derke").
		if fixed := ucFirst(pagename); fixed != pagename {
			player, err = s.fetchPlayerRecord(ctx, wiki, fixed)
		}
	}
	if err != nil {
		return nil, err
	}

	transfers := s.fetchPlayerTransfers(ctx, wiki, player.ID)
	normalized := models.NormalizeLiqPlayer(*player, wiki, transfers)
	return &normalized, nil
}

func ucFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func (s *LiquipediaService) fetchPlayerRecord(ctx context.Context, wiki, pagename string) (*models.LiqPlayer, error) {
	params := url.Values{}
	params.Set("conditions", fmt.Sprintf("[[pagename::%s]]", pagename))
	params.Set("limit", "1")

	data, err := s.MakeRequest(ctx, wiki, "player", params, cache.LiqPlayerKey(wiki, pagename), TTLTeam)
	if err != nil {
		return nil, err
	}
	resp, err := ParseResponse(data)
	if err != nil {
		return nil, err
	}
	if len(resp.Result) == 0 {
		return nil, ErrPlayerNotFound
	}

	var liqPlayer models.LiqPlayer
	if err := json.Unmarshal(resp.Result[0], &liqPlayer); err != nil {
		return nil, err
	}
	return &liqPlayer, nil
}

func (s *LiquipediaService) fetchPlayerTransfers(ctx context.Context, wiki, playerID string) []models.NormalizedTransfer {
	if playerID == "" {
		return nil
	}
	params := url.Values{}
	params.Set("conditions", fmt.Sprintf("[[player::%s]]", playerID))
	params.Set("order", "date DESC")
	params.Set("limit", "30")

	data, err := s.MakeRequest(ctx, wiki, "transfer", params, cache.LiqPlayerTransfersKey(wiki, playerID), TTLTeam)
	if err != nil {
		s.log.WithError(err).WithField("player", playerID).Warn("[PLAYER] transfers fetch failed — returning profile without history")
		return nil
	}
	resp, err := ParseResponse(data)
	if err != nil {
		return nil
	}

	transfers := make([]models.NormalizedTransfer, 0, len(resp.Result))
	for _, raw := range resp.Result {
		var t models.LiqTransfer
		if json.Unmarshal(raw, &t) != nil {
			continue
		}
		transfers = append(transfers, models.NormalizeLiqTransfer(t))
	}
	return transfers
}
