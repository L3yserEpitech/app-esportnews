package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/services"
)

// NewGameHandler creates a new game handler with GameService
func NewGameHandler(gameService *services.GameService) *GameHandler {
	return &GameHandler{
		gameService: gameService,
	}
}

// NewGameHandlerWithPool creates a new game handler with pgxpool (backward compatible)
func NewGameHandlerWithPool(db *pgxpool.Pool, redisCache *cache.RedisCache) *GameHandler {
	return &GameHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}

// NewTournamentHandler creates a new tournament handler with Liquipedia service and Redis cache
func NewTournamentHandler(liqService *services.LiquipediaService, redisCache *cache.RedisCache, logger *logrus.Logger) *TournamentHandler {
	return &TournamentHandler{
		liqService: liqService,
		redisCache: redisCache,
		log:        logger,
	}
}

// NewMatchHandler creates a new match handler with Liquipedia service and Redis cache
func NewMatchHandler(liqService *services.LiquipediaService, redisCache *cache.RedisCache, logger *logrus.Logger) *MatchHandler {
	return &MatchHandler{
		liqService: liqService,
		redisCache: redisCache,
		log:        logger,
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

// NewAuthHandler creates a new auth handler with AuthService
func NewAuthHandler(authService *services.AuthService, storageService *services.StorageService) *AuthHandler {
	return &AuthHandler{
		authService:    authService,
		storageService: storageService,
		JWTSecret:      authService.JWTSecret,
	}
}

// NewAuthHandlerWithPool creates a new auth handler with pgxpool (backward compatible)
func NewAuthHandlerWithPool(db *pgxpool.Pool, redisCache *cache.RedisCache, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
		JWTSecret: jwtSecret,
	}
}

// NewTeamHandler creates a new team handler with Liquipedia service, AuthService and GORM DB
func NewTeamHandler(liquipediaService *services.LiquipediaService, authService *services.AuthService, gormDB interface{}) *TeamHandler {
	return &TeamHandler{
		liquipediaService: liquipediaService,
		authService:       authService,
		gormDB:            gormDB,
	}
}

// NewNotificationHandler creates a new notification handler with GORM
func NewNotificationHandler(gormDB interface{}, authService *services.AuthService) *NotificationHandler {
	return &NotificationHandler{
		gormDB:      gormDB,
		authService: authService,
	}
}
