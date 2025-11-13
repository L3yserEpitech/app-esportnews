package config

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
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
		MaxConnections:   25,
	}

	cfg.JWTExpiration = 7 * 24 * time.Hour

	return cfg
}

func InitDB(cfg *Config) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}

	logrus.Info("Database connected successfully")
	return pool, nil
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}
