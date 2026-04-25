package cache

import (
	"crypto/sha1"
	"fmt"
	"strings"
)

// Cache key patterns
const (
	CacheGames           = "cache:games"
	CacheTournaments     = "cache:tournaments:%s"
	CacheMatches         = "cache:matches:%s:%s"
	CacheArticles        = "cache:articles:%s"
	CacheArticlesSimilar = "cache:articles:similar:%s"
	CacheAds             = "cache:ads"
	CacheTeams           = "cache:teams:%d"
	CacheUserFavorites   = "cache:user:favorites:%d"

	// PandaScore API (5 min cache)
	PandaScoreTournament          = "pandascore:tournament:%s"
	PandaScoreTournaments         = "pandascore:tournaments:%s:%s"
	PandaScoreTournamentsAllGames = "pandascore:tournaments:all:%s"
	PandaScoreTournamentsByDate   = "pandascore:tournaments:date:%s:%s"
	PandaScoreFilteredTournaments = "pandascore:tournaments:filtered:%s:%s:%s"
	PandaScoreMatch               = "pandascore:match:%s"
	PandaScoreMatches             = "pandascore:matches:%s:%s"
	PandaScoreRunningMatches      = "pandascore:matches:running:%s"
	PandaScoreUpcomingMatches     = "pandascore:matches:upcoming:%s"
	PandaScorePastMatches         = "pandascore:matches:past:%s"
	PandaScoreTeam                = "pandascore:team:%s"
	PandaScoreSearchTeams         = "pandascore:teams:search:%s"

	// Auth
	AuthJWT     = "auth:jwt:%s"
	AuthRefresh = "auth:refresh:%d"

	// Rate limiting
	RateLimit = "ratelimit:%s"
)

// Key builders
func GameKey(gameID int64) string {
	return fmt.Sprintf("cache:games:%d", gameID)
}

func TournamentsKey(gameAcronym string) string {
	return fmt.Sprintf(CacheTournaments, gameAcronym)
}

func MatchesKey(date, gameAcronym string) string {
	return fmt.Sprintf(CacheMatches, date, gameAcronym)
}

func ArticleKey(slug string) string {
	return fmt.Sprintf(CacheArticles, slug)
}

func ArticleSimilarKey(slug string) string {
	return fmt.Sprintf(CacheArticlesSimilar, slug)
}

// ArticleSearchKey builds a cache key for full-text search results.
//
// The query string is lowercased (FTS is case-insensitive, so we want
// "Valorant" and "valorant" to share a cache slot) and SHA1-hashed before
// going into the key, so user input — which can contain colons, spaces or
// other characters that conflict with Redis key parsers — never lands in
// the key verbatim. The other parameters are well-bounded and inlined.
func ArticleSearchKey(query, category string, excludeNews bool, limit int) string {
	h := sha1.Sum([]byte(strings.ToLower(strings.TrimSpace(query))))
	return fmt.Sprintf("cache:articles:search:%x:%s:%t:%d",
		h, category, excludeNews, limit)
}

// ArticleSearchPattern is the wildcard used to invalidate every cached
// search result on article create / update / delete.
const ArticleSearchPattern = "cache:articles:search:*"

func TeamKey(teamID int64) string {
	return fmt.Sprintf(CacheTeams, teamID)
}

func UserFavoritesKey(userID int64) string {
	return fmt.Sprintf(CacheUserFavorites, userID)
}

func JWTKey(tokenID string) string {
	return fmt.Sprintf(AuthJWT, tokenID)
}

func RefreshTokenKey(userID int64) string {
	return fmt.Sprintf(AuthRefresh, userID)
}

func RateLimitKey(ip string) string {
	return fmt.Sprintf(RateLimit, ip)
}

// PandaScore cache key builders
func PandaScoreTournamentKey(id string) string {
	return fmt.Sprintf(PandaScoreTournament, id)
}

func PandaScoreTournamentsKey(game, status string) string {
	return fmt.Sprintf(PandaScoreTournaments, game, status)
}

func PandaScoreTournamentsAllGamesKey(status string) string {
	return fmt.Sprintf(PandaScoreTournamentsAllGames, status)
}

func PandaScoreTournamentsByDateKey(date string, game *string) string {
	gameStr := "all"
	if game != nil && *game != "" {
		gameStr = *game
	}
	return fmt.Sprintf(PandaScoreTournamentsByDate, date, gameStr)
}

func PandaScoreFilteredTournamentsKey(game, status, tier string) string {
	return fmt.Sprintf(PandaScoreFilteredTournaments, game, status, tier)
}

func PandaScoreMatchKey(id string) string {
	return fmt.Sprintf(PandaScoreMatch, id)
}

func PandaScoreMatchesKey(date string, game *string) string {
	gameStr := "all"
	if game != nil && *game != "" {
		gameStr = *game
	}
	return fmt.Sprintf(PandaScoreMatches, date, gameStr)
}

func PandaScoreMatchesByDateKey(date string, game *string) string {
	// Alias for PandaScoreMatchesKey for consistency with service naming
	return PandaScoreMatchesKey(date, game)
}

func PandaScoreRunningMatchesKey(gameAcronym *string) string {
	gameStr := "all"
	if gameAcronym != nil && *gameAcronym != "" {
		gameStr = *gameAcronym
	}
	return fmt.Sprintf(PandaScoreRunningMatches, gameStr)
}

func PandaScoreUpcomingMatchesKey(gameAcronym *string) string {
	gameStr := "all"
	if gameAcronym != nil && *gameAcronym != "" {
		gameStr = *gameAcronym
	}
	return fmt.Sprintf(PandaScoreUpcomingMatches, gameStr)
}

func PandaScorePastMatchesKey(gameAcronym *string) string {
	gameStr := "all"
	if gameAcronym != nil && *gameAcronym != "" {
		gameStr = *gameAcronym
	}
	return fmt.Sprintf(PandaScorePastMatches, gameStr)
}

func PandaScoreTeamKey(id string) string {
	return fmt.Sprintf(PandaScoreTeam, id)
}

func PandaScoreSearchTeamsKey(query string) string {
	return fmt.Sprintf(PandaScoreSearchTeams, query)
}
