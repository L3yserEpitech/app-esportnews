package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
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
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:3002", "http://127.0.0.1:3002", "http://frontend.esportnews.orb.local", cfg.FrontendURL},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowMethods:     []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.PATCH, echo.OPTIONS},
		AllowCredentials: true, // Requis pour credentials: 'include' côté frontend
	}))

	// Rate limiting middleware
	e.Use(mw.RateLimitMiddleware(redisClient))

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	// API Routes
	apiGroup := e.Group("/api")

	// Initialize services
	gameService := services.NewGameServiceWithGORM(gormDB, redisClient)
	authService := services.NewAuthServiceWithGORM(gormDB, redisClient, cfg.JWTSecret)
	pandaScoreService := services.NewPandaScoreService(cfg.PandaScoreAPIKey, redisClient)
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
	tournamentHandler := handlers.NewTournamentHandler(pandaScoreService)
	matchHandler := handlers.NewMatchHandler(pandaScoreService)
	articleService := services.NewArticleServiceWithGORM(gormDB, redisClient)
	articleHandler := handlers.NewArticleHandlerWithService(articleService, authService, storageService)
	adService := services.NewAdServiceWithGORM(gormDB, redisClient)
	adHandler := handlers.NewAdHandlerWithStorage(adService, storageService)
	authHandler := handlers.NewAuthHandler(authService)
	teamHandler := handlers.NewTeamHandler(pandaScoreService, authService, gormDB)
	notificationHandler := handlers.NewNotificationHandler(gormDB, authService)
	stripeWebhookHandler := handlers.NewStripeWebhookHandler(stripeService, emailService, logger, cfg.StripeWebhookSecret)
	subscriptionHandler := handlers.NewSubscriptionHandler(stripeService, authService, logger, gormDB, cfg.FrontendURL)
	analyticsHandler := handlers.NewAnalyticsHandler(analyticsService)

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

	// Register admin routes with RequireAdmin middleware
	adminGroup := apiGroup.Group("")
	adminGroup.Use(mw.RequireAdmin(authService))
	articleHandler.RegisterAdminRoutes(adminGroup)
	adHandler.RegisterAdminRoutes(adminGroup)
	analyticsHandler.RegisterAdminRoutes(adminGroup) // Protected analytics endpoints

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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		logger.Errorf("Shutdown error: %v", err)
	}

	logger.Info("Server stopped")
}
