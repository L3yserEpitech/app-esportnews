package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/config"
	"github.com/esportnews/backend/internal/seed"
)

func main() {
	dataPath := flag.String("data", "initial_data/articles_rows.json", "Path to JSON file containing articles")
	dryRun := flag.Bool("dry-run", false, "Parse and validate without inserting into database")
	verbose := flag.Bool("v", false, "Verbose output")

	flag.Parse()

	// Initialize logger
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	if *verbose {
		logger.SetLevel(logrus.DebugLevel)
	} else {
		logger.SetLevel(logrus.InfoLevel)
	}

	logger.Info("Starting article seeding...")

	// Load configuration
	cfg := config.LoadConfig()

	// Initialize GORM database
	gormDB, err := config.InitGORM(cfg, logger)
	if err != nil {
		logger.Fatalf("Failed to initialize database: %v", err)
	}
	defer gormDB.Close()

	logger.Info("Database connected successfully")

	// Load articles from JSON
	logger.Infof("Loading articles from %s", *dataPath)
	articles, err := seed.LoadArticles(*dataPath)
	if err != nil {
		logger.Fatalf("Failed to load articles: %v", err)
	}

	logger.Infof("Loaded %d articles from JSON", len(articles))

	// Validate articles
	if err := seed.ValidateArticles(articles); err != nil {
		logger.Fatalf("Validation failed: %v", err)
	}

	logger.Info("All articles validated successfully")

	// Dry-run mode: only parse and validate
	if *dryRun {
		logger.Info("Dry-run mode: articles would be inserted successfully")
		fmt.Printf("\n✓ Dry-run passed: %d articles ready to import\n\n", len(articles))
		os.Exit(0)
	}

	// Seed articles into database
	logger.Info("Inserting articles into database...")
	result, err := seed.SeedArticles(gormDB.DB, articles)
	if err != nil {
		logger.Fatalf("Failed to seed articles: %v", err)
	}

	logger.Infof("Seeding completed: %d inserted, %d skipped (duplicates)", result.Inserted, result.Skipped)
	logger.Infof("Total articles in database: %d", result.Total)

	fmt.Printf("\n✓ Seeding completed successfully!\n")
	fmt.Printf("  - Inserted: %d articles\n", result.Inserted)
	fmt.Printf("  - Skipped: %d (duplicates or conflicts)\n", result.Skipped)
	fmt.Printf("  - Total in DB: %d articles\n\n", result.Total)
}
