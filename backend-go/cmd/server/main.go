package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/config"
	"github.com/esportnews/backend/internal/handlers"
	mw "github.com/esportnews/backend/internal/middleware"
	"github.com/esportnews/backend/internal/services"
)

// parseCSV splits a comma-separated string into a slice
func parseCSV(s string) []string {
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func main() {
	// Load environment variables
	cfg := config.LoadConfig()

	// Initialize logger
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetLevel(logrus.InfoLevel)

	// Initialize database with both pgxpool and GORM
	// pgxpool is used for backward compatibility with existing handlers/services
	// GORM is available for new code and incremental migration
	pool, gormDB, err := config.InitDBWithGORM(cfg, logger)
	if err != nil {
		logger.Fatalf("Failed to initialize database: %v", err)
	}
	defer pool.Close()
	defer gormDB.Close()

	// Initialize Redis
	redisClient := cache.NewRedisClient(cfg.RedisURL)
	defer redisClient.Close()

	// Create Echo instance
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	// Middleware
	e.Use(middleware.RequestID())
	e.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 6,
	}))
	e.Use(mw.LoggingMiddleware(logger))
	e.Use(mw.ErrorHandlerMiddleware())
	// Parse CORS origins from env var (comma-separated)
	corsOrigins := []string{
		"http://localhost:3000",
		"http://localhost:3002",
		"http://127.0.0.1:3002",
		"https://esportnews.fr",
		"https://www.esportnews.fr",
		"http://esportnews.fr",    // HTTP redirect support
		"http://www.esportnews.fr", // HTTP redirect support
		"https://esportnews-4skhma1nu-esport-news.vercel.app",  // Vercel preview
		"https://esportnews-amgpb7p1d-esport-news.vercel.app", // Vercel preview
	}
	if cfg.FrontendURL != "" {
		corsOrigins = append(corsOrigins, cfg.FrontendURL)
	}
	// Add CORS_ORIGINS from env if specified
	if cfg.CORSOrigins != "" {
		// Parse comma-separated list
		for _, origin := range parseCSV(cfg.CORSOrigins) {
			corsOrigins = append(corsOrigins, origin)
		}
	}

	// Build a set for fast lookup
	corsOriginsSet := make(map[string]bool)
	for _, o := range corsOrigins {
		corsOriginsSet[o] = true
	}

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOriginFunc: func(origin string) (bool, error) {
			// ⚠️ SÉCURITÉ: Si Origin est présent, il DOIT être dans la whitelist
			// Si Origin est vide (apps mobiles, curl, Postman), autoriser mais désactiver credentials
			if origin == "" {
				// Apps mobiles et outils - pas de credentials autorisées
				return true, nil
			}
			// Navigateurs web - vérifier whitelist stricte
			allowed := corsOriginsSet[origin]
			if !allowed {
				logger.Warnf("CORS rejected origin: %s", origin)
			}
			return allowed, nil
		},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowMethods:     []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.PATCH, echo.OPTIONS},
		AllowCredentials: true,                      // Requis pour credentials: 'include' côté frontend
		ExposeHeaders:    []string{"X-Total-Count"}, // Expose custom headers for pagination
	}))

	// Rate limiting middleware
	e.Use(mw.RateLimitMiddleware(redisClient))

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	// API Routes
	apiGroup := e.Group("/api")

	// 🔧 CORS Preflight: répondre explicitement aux requêtes OPTIONS
	// Echo CORS middleware ajoute les headers, mais ne répond pas automatiquement
	apiGroup.OPTIONS("/*", func(c echo.Context) error {
		return c.NoContent(204) // No Content avec headers CORS du middleware
	})

	// Initialize services
	gameService := services.NewGameServiceWithGORM(gormDB, redisClient)
	authService := services.NewAuthServiceWithGORM(gormDB, redisClient, cfg.JWTSecret)

	// Liquipedia service + poller + webhook dirty tracker
	liquipediaService := services.NewLiquipediaService(cfg.LiquipediaAPIKey, redisClient, logger)
	dirtyTracker := services.NewDirtyTracker()
	liquipediaPoller := services.NewLiquipediaPoller(liquipediaService, dirtyTracker, logger)
	if os.Getenv("LIQUIPEDIA_WEBHOOKS_ENABLED") == "true" {
		liquipediaPoller.SetWebhooksEnabled(true)
		logger.Info("Liquipedia webhooks mode enabled")
	}

	stripeService := services.NewStripeServiceWithGORM(gormDB, cfg.StripeSecretKey, cfg.StripePriceID, cfg.FrontendURL)
	emailService := services.NewEmailService(cfg.ResendAPIKey, cfg.EmailFrom)

	// Initialize StorageService for Cloudflare R2
	storageService, err := services.NewStorageService(
		cfg.R2Endpoint,
		cfg.R2AccessKeyID,
		cfg.R2SecretAccessKey,
		cfg.R2BucketName,
		cfg.R2PublicURL,
		logger,
	)
	if err != nil {
		logger.Fatalf("Failed to initialize storage service: %v", err)
	}

	// Initialize AnalyticsService
	analyticsService := services.NewAnalyticsService(gormDB, redisClient)

	// Initialize handlers
	gameHandler := handlers.NewGameHandler(gameService)
	tournamentHandler := handlers.NewTournamentHandler(liquipediaService, redisClient, logger)
	matchHandler := handlers.NewMatchHandler(liquipediaService, redisClient, logger)
	articleService := services.NewArticleServiceWithGORM(gormDB, redisClient)
	articleHandler := handlers.NewArticleHandlerWithService(articleService, authService, storageService)
	adService := services.NewAdServiceWithGORM(gormDB, redisClient)
	adHandler := handlers.NewAdHandlerWithStorage(adService, storageService)
	authHandler := handlers.NewAuthHandler(authService, storageService)
	teamHandler := handlers.NewTeamHandler(liquipediaService, authService, gormDB, redisClient, logger)
	notificationHandler := handlers.NewNotificationHandler(gormDB, authService)
	stripeWebhookHandler := handlers.NewStripeWebhookHandler(stripeService, emailService, logger, cfg.StripeWebhookSecret)
	subscriptionHandler := handlers.NewSubscriptionHandler(stripeService, authService, logger, gormDB, cfg.FrontendURL)
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService)
	webhookHandler := handlers.NewWebhookHandler(dirtyTracker, logger)
	imageProxyHandler := handlers.NewImageProxyHandler()

	// Register routes
	gameHandler.RegisterRoutes(apiGroup)
	tournamentHandler.RegisterRoutes(apiGroup)
	matchHandler.RegisterRoutes(apiGroup)
	articleHandler.RegisterRoutes(apiGroup)
	adHandler.RegisterRoutes(apiGroup)
	authHandler.RegisterRoutes(apiGroup)
	teamHandler.RegisterRoutes(apiGroup)
	notificationHandler.RegisterRoutes(apiGroup)
	stripeWebhookHandler.RegisterRoutes(apiGroup)
	subscriptionHandler.RegisterRoutes(apiGroup)
	analyticsHandler.RegisterRoutes(apiGroup) // Public tracking endpoint
	webhookHandler.RegisterRoutes(apiGroup)   // Liquipedia webhook endpoint
	imageProxyHandler.RegisterRoutes(apiGroup) // Image proxy for Liquipedia assets

	// Register admin routes with RequireAdmin middleware
	adminGroup := apiGroup.Group("")
	adminGroup.Use(mw.RequireAdmin(authService))
	articleHandler.RegisterAdminRoutes(adminGroup)
	adHandler.RegisterAdminRoutes(adminGroup)
	analyticsHandler.RegisterAdminRoutes(adminGroup) // Protected analytics endpoints

	// Liquipedia API budget monitoring (admin only)
	adminGroup.GET("/admin/api-budget", func(c echo.Context) error {
		return c.JSON(200, liquipediaService.GetBudgetStatus())
	})

	// Start Liquipedia poller in background
	pollerCtx, pollerCancel := context.WithCancel(context.Background())
	liquipediaPoller.Start(pollerCtx)

	// Start server
	go func() {
		addr := fmt.Sprintf(":%s", cfg.Port)
		logger.Infof("Server starting on %s", addr)
		if err := e.Start(addr); err != nil {
			logger.Errorf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Stop Liquipedia poller gracefully
	pollerCancel()
	liquipediaPoller.Stop()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		logger.Errorf("Shutdown error: %v", err)
	}

	logger.Info("Server stopped")
}
