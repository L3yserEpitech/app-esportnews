package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/esportnews/backend/internal/cache"
)

// NewGameHandler creates a new game handler
func NewGameHandler(db *pgxpool.Pool, redisCache *cache.RedisCache) *GameHandler {
	return &GameHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}

// NewTournamentHandler creates a new tournament handler
func NewTournamentHandler(db *pgxpool.Pool, redisCache *cache.RedisCache) *TournamentHandler {
	return &TournamentHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}

// NewMatchHandler creates a new match handler
func NewMatchHandler(db *pgxpool.Pool, redisCache *cache.RedisCache) *MatchHandler {
	return &MatchHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}

// NewArticleHandler creates a new article handler
func NewArticleHandler(db *pgxpool.Pool, redisCache *cache.RedisCache) *ArticleHandler {
	return &ArticleHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}

// NewAdHandler creates a new ad handler
func NewAdHandler(db *pgxpool.Pool, redisCache *cache.RedisCache) *AdHandler {
	return &AdHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(db *pgxpool.Pool, redisCache *cache.RedisCache, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
		JWTSecret: jwtSecret,
	}
}

// NewTeamHandler creates a new team handler
func NewTeamHandler(db *pgxpool.Pool, redisCache *cache.RedisCache) *TeamHandler {
	return &TeamHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}

// NewNotificationHandler creates a new notification handler
func NewNotificationHandler(db *pgxpool.Pool, redisCache *cache.RedisCache) *NotificationHandler {
	return &NotificationHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}
