// Package testdb opens the Postgres database of the integration tests.
package testdb

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// Open connects to TEST_DATABASE_URL, and skips the test when it is unset.
// Callers empty whole tables: a URL aimed at anything else must fail loudly,
// a skip would pass unnoticed in CI.
func Open(t testing.TB) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	if err := checkDSN(dsn); err != nil {
		t.Fatalf("TEST_DATABASE_URL refused: %v", err)
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	return db
}

// checkDSN goes through the parser the driver uses: a `host=` query parameter or
// a second host in the URL would otherwise slip past a plain URL check.
func checkDSN(dsn string) error {
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("unreadable URL")
	}
	hosts := []string{cfg.Host}
	for _, fallback := range cfg.Fallbacks {
		hosts = append(hosts, fallback.Host)
	}
	for _, host := range hosts {
		if host != "localhost" && host != "127.0.0.1" && host != "::1" {
			return fmt.Errorf("host %q is not local", host)
		}
	}
	if !strings.Contains(strings.ToLower(cfg.Database), "test") {
		return fmt.Errorf("database %q does not contain \"test\"", cfg.Database)
	}
	return nil
}
