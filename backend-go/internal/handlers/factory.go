package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"

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

// NewTournamentHandler creates a new tournament handler with PandaScoreService
func NewTournamentHandler(pandaService *services.PandaScoreService) *TournamentHandler {
	return &TournamentHandler{
		pandaService: pandaService,
	}
}

// NewTournamentHandlerWithPool creates a new tournament handler with pgxpool (backward compatible)
func NewTournamentHandlerWithPool(db *pgxpool.Pool, redisCache *cache.RedisCache) *TournamentHandler {
	return &TournamentHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
	}
}

// NewMatchHandler creates a new match handler with PandaScoreService
func NewMatchHandler(pandaService *services.PandaScoreService) *MatchHandler {
	return &MatchHandler{
		pandaService: pandaService,
	}
}

// NewMatchHandlerWithPool creates a new match handler with pgxpool (backward compatible)
func NewMatchHandlerWithPool(db *pgxpool.Pool, redisCache *cache.RedisCache) *MatchHandler {
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

// NewTeamHandler creates a new team handler with PandaScoreService and AuthService
func NewTeamHandler(pandaService *services.PandaScoreService, authService *services.AuthService, gormDB interface{}) *TeamHandler {
	return &TeamHandler{
		pandaService: pandaService,
		authService:  authService,
		gormDB:       gormDB,
	}
}

// NewTeamHandlerWithPool creates a new team handler with pgxpool (backward compatible)
func NewTeamHandlerWithPool(db *pgxpool.Pool, redisCache *cache.RedisCache, authService *services.AuthService) *TeamHandler {
	return &TeamHandler{
		BaseHandler: BaseHandler{
			DB:    db,
			Cache: redisCache,
		},
		authService: authService,
	}
}

// NewNotificationHandler creates a new notification handler with GORM
func NewNotificationHandler(gormDB interface{}, authService *services.AuthService) *NotificationHandler {
	return &NotificationHandler{
		gormDB:      gormDB,
		authService: authService,
	}
}
