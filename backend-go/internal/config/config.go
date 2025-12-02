package config

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/database"
)

type Config struct {
	// Server
	Port string
	Env  string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// JWT
	JWTSecret     string
	JWTExpiration time.Duration

	// Frontend
	FrontendURL string

	// PandaScore API
	PandaScoreAPIKey string

	// Stripe
	StripeSecretKey   string
	StripePriceID     string
	StripeWebhookSecret string

	// Resend Email
	ResendAPIKey string
	EmailFrom    string

	// App
	MaxConnections int
}

func LoadConfig() *Config {
	_ = godotenv.Load()

	cfg := &Config{
		Port:             getEnv("PORT", "4000"),
		Env:              getEnv("ENV", "development"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://esportnews:secret@localhost:5432/esportnews"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:        getEnv("JWT_SECRET", "your-secret-key"),
		FrontendURL:      getEnv("FRONTEND_URL", "http://localhost:3000"),
		PandaScoreAPIKey: getEnv("PANDASCORE_API_KEY", ""),
		StripeSecretKey:  getEnv("STRIPE_SECRET_KEY", ""),
		StripePriceID:    getEnv("STRIPE_PRICE_ID", "price_1SZoti3MOTiy12q9vCQLg1wG"),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
		ResendAPIKey:     getEnv("RESEND_API_KEY", ""),
		EmailFrom:        getEnv("EMAIL_FROM", "noreply@resend.dev"),
		MaxConnections:   25,
	}

	cfg.JWTExpiration = 7 * 24 * time.Hour

	return cfg
}

// InitDBWithGORM initializes both pgxpool and GORM for dual-mode database access
func InitDBWithGORM(cfg *Config, log *logrus.Logger) (*pgxpool.Pool, *database.Database, error) {
	// Initialize pgxpool for backward compatibility
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, nil, fmt.Errorf("unable to ping database: %w", err)
	}

	log.Info("Database (pgxpool) connected successfully")

	// Initialize GORM for new code
	gormDB, err := database.InitGORM(cfg.DatabaseURL, cfg.Env, log)
	if err != nil {
		pool.Close()
		return nil, nil, err
	}

	return pool, gormDB, nil
}

// InitGORM initializes GORM database connection only
func InitGORM(cfg *Config, log *logrus.Logger) (*database.Database, error) {
	return database.InitGORM(cfg.DatabaseURL, cfg.Env, log)
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}
