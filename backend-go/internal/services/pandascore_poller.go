package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
)

type PandaScorePoller struct {
	db       *pgxpool.Pool
	cache    *cache.RedisCache
	apiKey   string
	logger   *logrus.Logger
	stopChan chan bool
}

// PandaScore API response structures
type PandaTournament struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type PandaMatch struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func NewPandaScorePoller(db *pgxpool.Pool, cache *cache.RedisCache, apiKey string, logger *logrus.Logger) *PandaScorePoller {
	return &PandaScorePoller{
		db:       db,
		cache:    cache,
		apiKey:   apiKey,
		logger:   logger,
		stopChan: make(chan bool),
	}
}

// Start begins the polling loop (5 minute intervals)
func (p *PandaScorePoller) Start() {
	go p.pollLoop()
	p.logger.Info("PandaScore poller started (5 minute interval)")
}

// Stop gracefully stops the poller
func (p *PandaScorePoller) Stop() {
	p.stopChan <- true
	p.logger.Info("PandaScore poller stopped")
}

func (p *PandaScorePoller) pollLoop() {
	// Run immediately on startup
	p.syncTournaments()
	p.syncMatches()

	// Then run every 5 minutes
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-p.stopChan:
			return
		case <-ticker.C:
			p.syncTournaments()
			p.syncMatches()
		}
	}
}

// syncTournaments fetches and syncs tournaments from PandaScore
func (p *PandaScorePoller) syncTournaments() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := p.fetchAndSyncAllTournaments(ctx); err != nil {
		p.logger.Warnf("Failed to sync tournaments: %v", err)
	}

	p.logger.Debug("Tournament sync completed")
}

// fetchAndSyncAllTournaments fetches all tournaments and syncs them
func (p *PandaScorePoller) fetchAndSyncAllTournaments(ctx context.Context) error {
	url := "https://api.pandascore.co/tournaments?page=1&per_page=100&sort=-begin_at"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.apiKey))

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch tournaments: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("api returned %d: %s", resp.StatusCode, string(body))
	}

	var tournaments []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&tournaments); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	// Upsert into DB
	for _, t := range tournaments {
		pandaID, _ := t["id"].(float64)
		name, _ := t["name"].(string)
		slug, _ := t["slug"].(string)
		status, _ := t["status"].(string)

		// Get videogame_id if available
		var videogameID *int64
		if vg, ok := t["videogame"].(map[string]interface{}); ok {
			if id, ok := vg["id"].(float64); ok {
				vid := int64(id)
				videogameID = &vid
			}
		}

		_, err := p.db.Exec(ctx,
			`INSERT INTO public.tournaments (panda_id, name, slug, status, videogame_id)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (panda_id) DO UPDATE SET modified_at = NOW(), status = $4`,
			int64(pandaID), name, slug, status, videogameID,
		)
		if err != nil {
			p.logger.Debugf("Failed to upsert tournament %v: %v", pandaID, err)
		}
	}

	p.logger.Infof("Synced %d tournaments", len(tournaments))

	// Invalidate tournament caches
	gameAcronyms := []string{"valorant", "fifa", "wild_rift", "dota2", "overwatch", "call_of_duty", "league_of_legends", "rainbow_six_siege", "rocket_league", "cs2"}
	for _, acronym := range gameAcronyms {
		p.cache.Del(ctx, cache.TournamentsKey(acronym))
	}

	return nil
}

func (p *PandaScorePoller) fetchAndSyncTournaments(ctx context.Context, gameAcronym string) error {
	// Deprecated - kept for backward compatibility
	return nil
}

// syncMatches fetches and syncs matches from PandaScore
func (p *PandaScorePoller) syncMatches() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := p.fetchAndSyncMatches(ctx); err != nil {
		p.logger.Warnf("Failed to sync matches: %v", err)
	}

	p.logger.Debug("Match sync completed")
}

func (p *PandaScorePoller) fetchAndSyncMatches(ctx context.Context) error {
	// Fetch all matches (can filter by date if needed)
	url := "https://api.pandascore.co/matches?sort=-begin_at&page=1&per_page=100"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.apiKey))

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch matches: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("api returned %d: %s", resp.StatusCode, string(body))
	}

	var matches []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&matches); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	// Upsert into DB (simplified - just basic fields)
	for _, m := range matches {
		pandaID, _ := m["id"].(float64)
		name, _ := m["name"].(string)
		slug, _ := m["slug"].(string)
		status, _ := m["status"].(string)

		_, err := p.db.Exec(ctx,
			`INSERT INTO public.matches (panda_id, name, slug, status)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (panda_id) DO UPDATE SET modified_at = NOW(), status = $4`,
			int64(pandaID), name, slug, status,
		)
		if err != nil {
			p.logger.Debugf("Failed to upsert match %v: %v", pandaID, err)
		}
	}

	p.logger.Infof("Synced %d matches", len(matches))

	// Invalidate match caches (all dates)
	// This is a simple approach - could be optimized
	for i := 0; i < 7; i++ { // Invalidate last 7 days
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		games := []string{"valorant", "fifa", "wild_rift", "dota2", "overwatch", "call_of_duty", "league_of_legends", "rainbow_six_siege", "rocket_league", "cs2"}
		for _, game := range games {
			p.cache.Del(ctx, cache.MatchesKey(date, game))
		}
	}

	return nil
}

// HealthCheck returns the health status of the poller
func (p *PandaScorePoller) HealthCheck() map[string]interface{} {
	return map[string]interface{}{
		"status": "healthy",
		"poller": "pandascore",
	}
}
