package config

import (
	"context"
	"fmt"
	"os"
	"strconv"
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
	CORSOrigins string

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

	// Cloudflare R2
	R2AccountID        string
	R2AccessKeyID      string
	R2SecretAccessKey  string
	R2BucketName       string
	R2Endpoint         string
	R2PublicURL        string
	MaxUploadSize      int64
	UploadTimeout      time.Duration
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
		CORSOrigins:      getEnv("CORS_ORIGINS", ""),
		PandaScoreAPIKey: getEnv("PANDASCORE_API_KEY", ""),
		StripeSecretKey:  getEnv("STRIPE_SECRET_KEY", ""),
		StripePriceID:    getEnv("STRIPE_PRICE_ID", "price_1SZoti3MOTiy12q9vCQLg1wG"),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
		ResendAPIKey:     getEnv("RESEND_API_KEY", ""),
		EmailFrom:        getEnv("EMAIL_FROM", "noreply@resend.dev"),
		MaxConnections:   25,

		// Cloudflare R2
		R2AccountID:       getEnv("CLOUDFLARE_ACCOUNT_ID", ""),
		R2AccessKeyID:     getEnv("CLOUDFLARE_R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey: getEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", ""),
		R2BucketName:      getEnv("CLOUDFLARE_R2_BUCKET_NAME", "esportnews-bucket"),
		R2Endpoint:        getEnv("CLOUDFLARE_R2_ENDPOINT", ""),
		R2PublicURL:       getEnv("CLOUDFLARE_R2_PUBLIC_URL", ""),
		MaxUploadSize:     getEnvInt64("MAX_UPLOAD_SIZE", 524288000), // 500MB default
	}

	cfg.JWTExpiration = 7 * 24 * time.Hour
	cfg.UploadTimeout = time.Duration(getEnvInt("UPLOAD_TIMEOUT", 600)) * time.Second // 10 minutes default

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

func getEnvInt(key string, defaultVal int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultVal
}

func getEnvInt64(key string, defaultVal int64) int64 {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intVal
		}
	}
	return defaultVal
}
