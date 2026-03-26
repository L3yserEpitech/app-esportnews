package database

import (
	"context"
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"

	"github.com/esportnews/backend/internal/models"
)

// Database wraps GORM DB instance and provides pgxpool compatibility
type Database struct {
	*gorm.DB
}

// Query executes a query and returns rows (pgxpool compatibility)
func (d *Database) Query(ctx context.Context, query string, args ...interface{}) (interface{}, error) {
	rows, err := d.DB.WithContext(ctx).Raw(query, args...).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}
	if rows == nil {
		return nil, fmt.Errorf("failed to execute query: no rows returned")
	}
	return rows, nil
}

// QueryRow executes a query and returns a single row (pgxpool compatibility)
func (d *Database) QueryRow(ctx context.Context, query string, args ...interface{}) interface{} {
	return d.DB.WithContext(ctx).Raw(query, args...).Row()
}

// Exec executes a query (pgxpool compatibility)
func (d *Database) Exec(ctx context.Context, query string, args ...interface{}) error {
	return d.DB.WithContext(ctx).Exec(query, args...).Error
}

// InitGORM initializes GORM connection to PostgreSQL
func InitGORM(databaseURL string, env string, log *logrus.Logger) (*Database, error) {
	// Determine log level based on environment
	logLevel := logger.Silent
	if env == "development" {
		logLevel = logger.Info
	}

	// Append default_query_exec_mode=simple_protocol to disable pgx statement cache
	// This prevents "prepared statement already exists" errors with Supabase pooler
	connURL := databaseURL
	if !strings.Contains(connURL, "default_query_exec_mode") {
		if strings.Contains(connURL, "?") {
			connURL += "&default_query_exec_mode=simple_protocol"
		} else {
			connURL += "?default_query_exec_mode=simple_protocol"
		}
	}

	// Open connection with PrepareStmt disabled to avoid cache conflicts
	db, err := gorm.Open(postgres.Open(connURL), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "",
			SingularTable: true,
		},
		PrepareStmt: false, // Disable prepared statement cache to avoid conflicts
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Info("Connected to database with GORM")

	// Get underlying SQL database to configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)

	// Always migrate new tables (not present in legacy Supabase schema)
	if err := db.AutoMigrate(
		&models.PushToken{},
		&models.MatchSubscription{},
		&models.TournamentSubscription{},
	); err != nil {
		return nil, fmt.Errorf("failed to run new table migrations: %w", err)
	}
	log.Info("New table migrations completed (push_token, match_subscription, tournament_subscription)")

	// Auto migrate legacy models only in development (tables already exist in production/Supabase)
	if env == "development" {
		if err := db.AutoMigrate(
			&models.User{},
			&models.Game{},
			&models.Article{},
			&models.Ad{},
			&models.Notification{},
			&models.PageView{},
		); err != nil {
			return nil, fmt.Errorf("failed to run dev migrations: %w", err)
		}
		log.Info("Development migrations completed")
	}

	return &Database{DB: db}, nil
}

// Close closes the database connection
func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
