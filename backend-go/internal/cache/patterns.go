package cache

import "fmt"

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
	PandaScoreTournament         = "pandascore:tournament:%s"
	PandaScoreTournaments        = "pandascore:tournaments:%s:%s"
	PandaScoreTournamentsByDate  = "pandascore:tournaments:date:%s:%s"
	PandaScoreFilteredTournaments = "pandascore:tournaments:filtered:%s:%s:%s"
	PandaScoreMatch              = "pandascore:match:%s"
	PandaScoreMatches            = "pandascore:matches:%s:%s"
	PandaScoreTeam               = "pandascore:team:%s"
	PandaScoreSearchTeams        = "pandascore:teams:search:%s"

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

func PandaScoreTeamKey(id string) string {
	return fmt.Sprintf(PandaScoreTeam, id)
}

func PandaScoreSearchTeamsKey(query string) string {
	return fmt.Sprintf(PandaScoreSearchTeams, query)
}
