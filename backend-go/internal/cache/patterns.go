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
