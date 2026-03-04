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

	// Liquipedia API cache keys — populated by poller & webhooks, read by handlers
	LiqMatchesRunning  = "liq:matches:running:%s"  // %s = wiki (e.g. "valorant")
	LiqMatchesUpcoming = "liq:matches:upcoming:%s"
	LiqMatchesPast     = "liq:matches:past:%s"
	LiqMatchesByDate   = "liq:matches:date:%s:%s" // %s = wiki, %s = YYYY-MM-DD
	LiqMatch           = "liq:match:%s:%s"         // %s = wiki, %s = match id/page
	LiqTournamentsRunning  = "liq:tournaments:running:%s"
	LiqTournamentsUpcoming = "liq:tournaments:upcoming:%s"
	LiqTournamentsFinished = "liq:tournaments:finished:%s"
	LiqTournament          = "liq:tournament:%s:%s"          // %s = wiki, %s = tournament id/page
	LiqTournamentMatches   = "liq:tournament:matches:%s:%s" // %s = wiki, %s = tournament pagename
	LiqTournamentSquads    = "liq:tournament:squads:%s:%s" // %s = wiki, %s = tournament pagename
	LiqTeamSearch          = "liq:teams:search:%s:%s"      // %s = wiki, %s = query
	LiqTeam                = "liq:team:%s:%s"              // %s = wiki, %s = team id/page
	LiqTeamSquad           = "liq:team:squad:%s:%s"        // %s = wiki, %s = team pagename

	// Stale cache suffix — appended to any key above for stale-while-revalidate
	LiqStaleSuffix = ":stale"

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

// --- Liquipedia key builders ---

func LiqMatchesRunningKey(wiki string) string {
	return fmt.Sprintf(LiqMatchesRunning, wiki)
}

func LiqMatchesUpcomingKey(wiki string) string {
	return fmt.Sprintf(LiqMatchesUpcoming, wiki)
}

func LiqMatchesPastKey(wiki string) string {
	return fmt.Sprintf(LiqMatchesPast, wiki)
}

func LiqMatchesByDateKey(wiki, date string) string {
	return fmt.Sprintf(LiqMatchesByDate, wiki, date)
}

func LiqMatchKey(wiki, matchID string) string {
	return fmt.Sprintf(LiqMatch, wiki, matchID)
}

func LiqTournamentsRunningKey(wiki string) string {
	return fmt.Sprintf(LiqTournamentsRunning, wiki)
}

func LiqTournamentsUpcomingKey(wiki string) string {
	return fmt.Sprintf(LiqTournamentsUpcoming, wiki)
}

func LiqTournamentsFinishedKey(wiki string) string {
	return fmt.Sprintf(LiqTournamentsFinished, wiki)
}

func LiqTournamentKey(wiki, tournamentID string) string {
	return fmt.Sprintf(LiqTournament, wiki, tournamentID)
}

func LiqTournamentMatchesKey(wiki, tournamentPageName string) string {
	return fmt.Sprintf(LiqTournamentMatches, wiki, tournamentPageName)
}

func LiqTournamentSquadsKey(wiki, tournamentPageName string) string {
	return fmt.Sprintf(LiqTournamentSquads, wiki, tournamentPageName)
}

func LiqTeamSearchKey(wiki, query string) string {
	return fmt.Sprintf(LiqTeamSearch, wiki, query)
}

func LiqTeamKey(wiki, teamID string) string {
	return fmt.Sprintf(LiqTeam, wiki, teamID)
}

func LiqTeamSquadKey(wiki, teamPageName string) string {
	return fmt.Sprintf(LiqTeamSquad, wiki, teamPageName)
}

// StaleKey returns the stale-while-revalidate variant of any cache key.
func StaleKey(key string) string {
	return key + LiqStaleSuffix
}
