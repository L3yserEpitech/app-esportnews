package services

import (
	"context"
	"encoding/csv"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"

	"gorm.io/gorm"
)

type AnalyticsService struct {
	db    *gorm.DB
	redis *cache.RedisCache
}

func NewAnalyticsService(gormDB *database.Database, redis *cache.RedisCache) *AnalyticsService {
	return &AnalyticsService{
		db:    gormDB.DB, // Extract *gorm.DB from *database.Database wrapper
		redis: redis,
	}
}

// RecordPageView enregistre une nouvelle page view en base de données
func (s *AnalyticsService) RecordPageView(ctx context.Context, input models.TrackPageViewInput) error {
	pageView := models.PageView{
		VisitorID: input.VisitorID,
		UserID:    input.UserID,
		Path:      input.Path,
		Referer:   input.Referer,
		UserAgent: input.UserAgent,
		CreatedAt: time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(&pageView).Error; err != nil {
		return fmt.Errorf("failed to record page view: %w", err)
	}

	// Invalider le cache pour forcer le recalcul
	s.invalidateVisitorCache()

	return nil
}

// GetVisitorStats retourne les statistiques de visiteurs pour une timeline donnée
func (s *AnalyticsService) GetVisitorStats(ctx context.Context, timeline string) (*models.VisitorStats, error) {
	// Note: Cache Redis désactivé pour refresh manuel
	// Si besoin: cacheKey := fmt.Sprintf("analytics:visitors:%s:%s", timeline, time.Now().Format("2006-01-02"))
	// s.redis.Get(ctx, cacheKey, &stats)

	interval, days := getIntervalFromTimeline(timeline)
	if interval == "" {
		return nil, fmt.Errorf("invalid timeline: %s (must be 24h, week, month, or year)", timeline)
	}

	stats := &models.VisitorStats{
		Timeline: timeline,
	}

	// Query 1: Total unique visitors
	// Note: INTERVAL ne supporte pas les placeholders, on utilise gorm.Expr()
	var totalVisitors int64
	if err := s.db.WithContext(ctx).
		Model(&models.PageView{}).
		Where(fmt.Sprintf("created_at >= NOW() - INTERVAL '%s'", interval)).
		Distinct("visitor_id").
		Count(&totalVisitors).Error; err != nil {
		return nil, fmt.Errorf("failed to count unique visitors: %w", err)
	}
	stats.TotalVisitors = totalVisitors

	// Query 2: Total page views
	var totalViews int64
	if err := s.db.WithContext(ctx).
		Model(&models.PageView{}).
		Where(fmt.Sprintf("created_at >= NOW() - INTERVAL '%s'", interval)).
		Count(&totalViews).Error; err != nil {
		return nil, fmt.Errorf("failed to count page views: %w", err)
	}
	stats.TotalPageViews = totalViews

	// Query 3: Daily breakdown for charts
	type breakdownResult struct {
		Date     string
		Visitors int64
		Views    int64
	}

	var results []breakdownResult
	query := fmt.Sprintf(`
		SELECT 
			DATE(created_at) as date,
			COUNT(DISTINCT visitor_id) as visitors,
			COUNT(*) as views
		FROM page_views
		WHERE created_at >= NOW() - INTERVAL '%s'
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`, interval)

	if err := s.db.WithContext(ctx).Raw(query).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get daily breakdown: %w", err)
	}

	stats.Breakdown = make([]models.VisitorBreakdown, len(results))
	for i, r := range results {
		stats.Breakdown[i] = models.VisitorBreakdown{
			Date:     r.Date,
			Visitors: r.Visitors,
			Views:    r.Views,
		}
	}

	// Calculate average per day
	if days > 0 {
		stats.AvgPerDay = float64(totalVisitors) / float64(days)
		stats.AvgPerDay = math.Round(stats.AvgPerDay*100) / 100 // Round to 2 decimals
	}

	// Cache for 5 minutes (optionnel, désactivé pour refresh manuel)
	// s.redis.Set(ctx, cacheKey, stats, 5*time.Minute)

	return stats, nil
}

// GetRegistrationStats retourne les statistiques d'inscriptions pour une timeline donnée
func (s *AnalyticsService) GetRegistrationStats(ctx context.Context, timeline string) (*models.RegistrationStats, error) {
	interval, days := getIntervalFromTimeline(timeline)
	if interval == "" {
		return nil, fmt.Errorf("invalid timeline: %s (must be day, week, month, or year)", timeline)
	}

	stats := &models.RegistrationStats{
		Timeline: timeline,
	}

	// Query 1: Total new registrations
	var totalUsers int64
	if err := s.db.WithContext(ctx).
		Model(&models.User{}).
		Where(fmt.Sprintf("created_at >= NOW() - INTERVAL '%s'", interval)).
		Count(&totalUsers).Error; err != nil {
		return nil, fmt.Errorf("failed to count registrations: %w", err)
	}
	stats.TotalUsers = totalUsers

	// Query 2: Daily breakdown
	type breakdownResult struct {
		Date  string
		Count int64
	}

	var results []breakdownResult
	query := fmt.Sprintf(`
		SELECT 
			DATE(created_at) as date,
			COUNT(*) as count
		FROM users
		WHERE created_at >= NOW() - INTERVAL '%s'
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`, interval)

	if err := s.db.WithContext(ctx).Raw(query).Scan(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get registration breakdown: %w", err)
	}

	stats.Breakdown = make([]models.RegistrationBreakdown, len(results))
	for i, r := range results {
		stats.Breakdown[i] = models.RegistrationBreakdown{
			Date:  r.Date,
			Count: r.Count,
		}
	}

	// Calculate average per day
	if days > 0 {
		stats.AvgPerDay = float64(totalUsers) / float64(days)
		stats.AvgPerDay = math.Round(stats.AvgPerDay*100) / 100
	}

	return stats, nil
}

// ExportAnalyticsData génère un CSV avec les données combinées (visiteurs + inscriptions)
func (s *AnalyticsService) ExportAnalyticsData(ctx context.Context, timeline string) (string, error) {
	visitorStats, err := s.GetVisitorStats(ctx, timeline)
	if err != nil {
		return "", fmt.Errorf("failed to get visitor stats: %w", err)
	}

	registrationStats, err := s.GetRegistrationStats(ctx, timeline)
	if err != nil {
		return "", fmt.Errorf("failed to get registration stats: %w", err)
	}

	// Merge data by date
	dataMap := make(map[string]*models.ExportDataRow)

	for _, v := range visitorStats.Breakdown {
		dataMap[v.Date] = &models.ExportDataRow{
			Date:           v.Date,
			UniqueVisitors: v.Visitors,
			TotalPageViews: v.Views,
		}
	}

	for _, r := range registrationStats.Breakdown {
		if row, exists := dataMap[r.Date]; exists {
			row.NewRegistrations = r.Count
		} else {
			dataMap[r.Date] = &models.ExportDataRow{
				Date:             r.Date,
				NewRegistrations: r.Count,
			}
		}
	}

	// Sort dates
	dates := make([]string, 0, len(dataMap))
	for date := range dataMap {
		dates = append(dates, date)
	}
	// Simple sort (dates are YYYY-MM-DD format)
	for i := 0; i < len(dates); i++ {
		for j := i + 1; j < len(dates); j++ {
			if dates[i] > dates[j] {
				dates[i], dates[j] = dates[j], dates[i]
			}
		}
	}

	// Generate CSV
	var csvBuilder strings.Builder
	writer := csv.NewWriter(&csvBuilder)

	// Header
	if err := writer.Write([]string{"Date", "Visiteurs Uniques", "Pages Vues", "Nouvelles Inscriptions"}); err != nil {
		return "", fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Data rows
	for _, date := range dates {
		row := dataMap[date]
		if err := writer.Write([]string{
			row.Date,
			strconv.FormatInt(row.UniqueVisitors, 10),
			strconv.FormatInt(row.TotalPageViews, 10),
			strconv.FormatInt(row.NewRegistrations, 10),
		}); err != nil {
			return "", fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", fmt.Errorf("CSV writer error: %w", err)
	}

	return csvBuilder.String(), nil
}

// invalidateVisitorCache invalide tous les caches de visiteurs
func (s *AnalyticsService) invalidateVisitorCache() {
	// Pattern matching pour supprimer toutes les clés analytics:visitors:*
	// Note: Redis SCAN pattern (implémentation simplifiée)
	timelines := []string{"24h", "week", "month", "year"}
	today := time.Now().Format("2006-01-02")

	for _, tl := range timelines {
		key := fmt.Sprintf("analytics:visitors:%s:%s", tl, today)
		s.redis.Del(context.Background(), key)
	}
}

// getIntervalFromTimeline convertit un timeline string en interval PostgreSQL et nombre de jours
func getIntervalFromTimeline(timeline string) (string, int) {
	switch timeline {
	case "24h", "day":
		return "24 hours", 1
	case "week":
		return "7 days", 7
	case "month":
		return "1 month", 30
	case "year":
		return "1 year", 365
	default:
		return "", 0
	}
}
