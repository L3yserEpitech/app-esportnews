package services

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/models"
)

// Polling intervals — Scenario B (without webhooks, fallback).
// With webhooks active, these serve as a safety net only.
const (
	PollIntervalMatchesRunning      = 2 * time.Minute
	PollIntervalMatchesUpcoming     = 10 * time.Minute
	PollIntervalMatchesPast         = 15 * time.Minute
	PollIntervalTournamentsRunning  = 10 * time.Minute
	PollIntervalTournamentsUpcoming = 15 * time.Minute
	PollIntervalTournamentsFinished = 30 * time.Minute

	// How often the poller checks dirty flags from webhooks
	DirtyCheckInterval = 2 * time.Minute
)

// DirtyFlag tracks which data types have been modified for a given wiki.
// Set by the WebhookHandler, consumed by the Poller.
type DirtyFlag struct {
	MatchesRunning  bool
	MatchesUpcoming bool
	MatchesPast     bool
	Tournaments     bool
	Teams           bool
	LastEvent       time.Time
}

// DirtyTracker manages dirty flags per wiki, thread-safe.
type DirtyTracker struct {
	flags map[string]*DirtyFlag
	mu    sync.Mutex
}

// NewDirtyTracker creates a new DirtyTracker.
func NewDirtyTracker() *DirtyTracker {
	return &DirtyTracker{
		flags: make(map[string]*DirtyFlag),
	}
}

// MarkDirty marks specific data types as dirty for a wiki, based on a webhook event.
func (dt *DirtyTracker) MarkDirty(event models.LiquipediaWebhookEvent) {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	flag, ok := dt.flags[event.Wiki]
	if !ok {
		flag = &DirtyFlag{}
		dt.flags[event.Wiki] = flag
	}

	if event.Namespace == -10 {
		// Teamtemplates namespace → team data changed
		flag.Teams = true
	} else {
		// Namespace 0 = main content. We can't easily distinguish match vs tournament
		// from the page name alone, so mark all as dirty. The cost is bounded by
		// debounce intervals (only 1 fetch per type per interval regardless of webhook count).
		flag.MatchesRunning = true
		flag.MatchesUpcoming = true
		flag.MatchesPast = true
		flag.Tournaments = true
	}
	flag.LastEvent = time.Now()
}

// GetAndResetDirty returns all dirty flags and resets them atomically.
func (dt *DirtyTracker) GetAndResetDirty() map[string]*DirtyFlag {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	result := dt.flags
	dt.flags = make(map[string]*DirtyFlag)
	return result
}

// HasAnyDirty returns true if any wiki has dirty flags.
func (dt *DirtyTracker) HasAnyDirty() bool {
	dt.mu.Lock()
	defer dt.mu.Unlock()
	return len(dt.flags) > 0
}

// LiquipediaPoller runs background goroutines that periodically fetch data
// from Liquipedia and store it in Redis. It supports two modes:
// 1. Polling (fallback): fetch at fixed intervals regardless of changes
// 2. Webhook-driven (preferred): only fetch when dirty flags are set
type LiquipediaPoller struct {
	service      *LiquipediaService
	dirtyTracker *DirtyTracker
	log          *logrus.Logger
	cancel       context.CancelFunc
	wg           sync.WaitGroup

	// webhooksEnabled controls whether to use dirty-flag mode (true) or blind polling (false).
	// Set to true once webhooks are confirmed working.
	webhooksEnabled bool
}

// NewLiquipediaPoller creates a poller. Pass dirtyTracker from the WebhookHandler.
func NewLiquipediaPoller(service *LiquipediaService, dirtyTracker *DirtyTracker, logger *logrus.Logger) *LiquipediaPoller {
	return &LiquipediaPoller{
		service:         service,
		dirtyTracker:    dirtyTracker,
		log:             logger,
		webhooksEnabled: false, // start with polling, enable webhooks when confirmed
	}
}

// SetWebhooksEnabled toggles webhook-driven mode on/off.
func (p *LiquipediaPoller) SetWebhooksEnabled(enabled bool) {
	p.webhooksEnabled = enabled
}

// Start launches background polling goroutines for all known games.
func (p *LiquipediaPoller) Start(ctx context.Context) {
	ctx, p.cancel = context.WithCancel(ctx)

	if p.service.apiKey == "" {
		p.log.Warn("Liquipedia API key not set — poller disabled")
		return
	}

	p.log.Info("Starting Liquipedia poller for all games")

	for acronym, wiki := range models.GameWikiMapping {
		p.wg.Add(1)
		go p.pollGame(ctx, acronym, wiki)
	}

	// Dirty flag consumer (for webhook-driven refreshes)
	p.wg.Add(1)
	go p.consumeDirtyFlags(ctx)
}

// Stop gracefully shuts down all polling goroutines.
func (p *LiquipediaPoller) Stop() {
	if p.cancel != nil {
		p.cancel()
	}
	p.wg.Wait()
	p.log.Info("Liquipedia poller stopped")
}

// pollGame runs tickers for each endpoint type for a single game wiki.
// This is the Scenario B (blind polling) fallback.
func (p *LiquipediaPoller) pollGame(ctx context.Context, acronym, wiki string) {
	defer p.wg.Done()

	tickerRunning := time.NewTicker(PollIntervalMatchesRunning)
	tickerUpcoming := time.NewTicker(PollIntervalMatchesUpcoming)
	tickerPast := time.NewTicker(PollIntervalMatchesPast)
	tickerTourRunning := time.NewTicker(PollIntervalTournamentsRunning)
	tickerTourUpcoming := time.NewTicker(PollIntervalTournamentsUpcoming)
	tickerTourFinished := time.NewTicker(PollIntervalTournamentsFinished)
	defer tickerRunning.Stop()
	defer tickerUpcoming.Stop()
	defer tickerPast.Stop()
	defer tickerTourRunning.Stop()
	defer tickerTourUpcoming.Stop()
	defer tickerTourFinished.Stop()

	p.log.WithFields(logrus.Fields{"game": acronym, "wiki": wiki}).Info("Poller started for game")

	// Initial fetch on startup (staggered to avoid burst)
	time.Sleep(time.Duration(len(acronym)%5) * 2 * time.Second) // simple stagger
	p.refreshMatchesRunning(ctx, wiki)

	for {
		select {
		case <-ctx.Done():
			return

		case <-tickerRunning.C:
			if !p.webhooksEnabled {
				p.refreshMatchesRunning(ctx, wiki)
			}

		case <-tickerUpcoming.C:
			if !p.webhooksEnabled {
				p.refreshMatchesUpcoming(ctx, wiki)
			}

		case <-tickerPast.C:
			if !p.webhooksEnabled {
				p.refreshMatchesPast(ctx, wiki)
			}

		case <-tickerTourRunning.C:
			if !p.webhooksEnabled {
				p.refreshTournamentsRunning(ctx, wiki)
			}

		case <-tickerTourUpcoming.C:
			if !p.webhooksEnabled {
				p.refreshTournamentsUpcoming(ctx, wiki)
			}

		case <-tickerTourFinished.C:
			if !p.webhooksEnabled {
				p.refreshTournamentsFinished(ctx, wiki)
			}
		}
	}
}

// consumeDirtyFlags checks dirty flags periodically and triggers targeted refreshes.
// This is the Scenario A (webhook-driven) path.
func (p *LiquipediaPoller) consumeDirtyFlags(ctx context.Context) {
	defer p.wg.Done()

	ticker := time.NewTicker(DirtyCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !p.webhooksEnabled || !p.dirtyTracker.HasAnyDirty() {
				continue
			}

			dirtyWikis := p.dirtyTracker.GetAndResetDirty()
			for wiki, flags := range dirtyWikis {
				if flags.MatchesRunning {
					go p.refreshMatchesRunning(ctx, wiki)
				}
				if flags.MatchesUpcoming {
					go p.refreshMatchesUpcoming(ctx, wiki)
				}
				if flags.MatchesPast {
					go p.refreshMatchesPast(ctx, wiki)
				}
				if flags.Tournaments {
					go p.refreshTournamentsRunning(ctx, wiki)
					go p.refreshTournamentsUpcoming(ctx, wiki)
				}
			}
		}
	}
}

// --- Refresh methods ---
// Each method makes 1 API request that returns ALL items of that type for the wiki.
// Match conditions use Liquipedia API v3 query syntax.

func (p *LiquipediaPoller) refreshMatchesRunning(ctx context.Context, wiki string) {
	cacheKey := cache.LiqMatchesRunningKey(wiki)
	now := time.Now().UTC()
	cutoff := now.Add(6 * time.Hour).Format("2006-01-02 15:04:05")
	pastCutoff := now.Add(-24 * time.Hour).Format("2006-01-02 15:04:05")

	params := url.Values{}
	params.Set("conditions", fmt.Sprintf(
		"[[finished::0]] AND [[dateexact::1]] AND [[date::<%s]] AND [[date::>%s]]",
		cutoff, pastCutoff,
	))
	params.Set("order", "date ASC")
	params.Set("limit", "50")
	params.Set("rawstreams", "true")
	params.Set("streamurls", "true")

	_, err := p.service.MakeRequest(ctx, wiki, "match", params, cacheKey, TTLMatchesRunning)
	if err != nil {
		p.log.WithFields(logrus.Fields{"wiki": wiki, "type": "matches_running"}).WithError(err).Warn("Failed to refresh")
	}
}

func (p *LiquipediaPoller) refreshMatchesUpcoming(ctx context.Context, wiki string) {
	cacheKey := cache.LiqMatchesUpcomingKey(wiki)
	now := time.Now().UTC().Format("2006-01-02 15:04:05")

	params := url.Values{}
	params.Set("conditions", fmt.Sprintf(
		"[[finished::0]] AND [[dateexact::1]] AND [[date::>%s]]",
		now,
	))
	params.Set("order", "date ASC")
	params.Set("limit", "50")
	params.Set("rawstreams", "true")
	params.Set("streamurls", "true")

	_, err := p.service.MakeRequest(ctx, wiki, "match", params, cacheKey, TTLMatchesUpcoming)
	if err != nil {
		p.log.WithFields(logrus.Fields{"wiki": wiki, "type": "matches_upcoming"}).WithError(err).Warn("Failed to refresh")
	}
}

func (p *LiquipediaPoller) refreshMatchesPast(ctx context.Context, wiki string) {
	cacheKey := cache.LiqMatchesPastKey(wiki)

	params := url.Values{}
	params.Set("conditions", "[[finished::1]]")
	params.Set("order", "date DESC")
	params.Set("limit", "50")
	params.Set("rawstreams", "true")
	params.Set("streamurls", "true")

	_, err := p.service.MakeRequest(ctx, wiki, "match", params, cacheKey, TTLMatchesPast)
	if err != nil {
		p.log.WithFields(logrus.Fields{"wiki": wiki, "type": "matches_past"}).WithError(err).Warn("Failed to refresh")
	}
}

func (p *LiquipediaPoller) refreshTournamentsRunning(ctx context.Context, wiki string) {
	cacheKey := cache.LiqTournamentsRunningKey(wiki)
	today := time.Now().UTC().Format("2006-01-02")

	params := url.Values{}
	params.Set("conditions", fmt.Sprintf(
		"[[status::!finished]] AND [[startdate::<=%s]] AND [[enddate::>=%s]]",
		today, today,
	))
	params.Set("order", "liquipediatier ASC, startdate ASC")
	params.Set("limit", "50")

	_, err := p.service.MakeRequest(ctx, wiki, "tournament", params, cacheKey, TTLTournamentsRunning)
	if err != nil {
		p.log.WithFields(logrus.Fields{"wiki": wiki, "type": "tournaments_running"}).WithError(err).Warn("Failed to refresh")
	}
}

func (p *LiquipediaPoller) refreshTournamentsUpcoming(ctx context.Context, wiki string) {
	cacheKey := cache.LiqTournamentsUpcomingKey(wiki)
	today := time.Now().UTC().Format("2006-01-02")

	params := url.Values{}
	params.Set("conditions", fmt.Sprintf(
		"[[status::!finished]] AND [[startdate::>%s]]",
		today,
	))
	params.Set("order", "startdate ASC")
	params.Set("limit", "50")

	_, err := p.service.MakeRequest(ctx, wiki, "tournament", params, cacheKey, TTLTournamentsUpcoming)
	if err != nil {
		p.log.WithFields(logrus.Fields{"wiki": wiki, "type": "tournaments_upcoming"}).WithError(err).Warn("Failed to refresh")
	}
}

func (p *LiquipediaPoller) refreshTournamentsFinished(ctx context.Context, wiki string) {
	cacheKey := cache.LiqTournamentsFinishedKey(wiki)

	params := url.Values{}
	params.Set("conditions", "[[status::finished]]")
	params.Set("order", "enddate DESC")
	params.Set("limit", "50")

	_, err := p.service.MakeRequest(ctx, wiki, "tournament", params, cacheKey, TTLTournamentsFinished)
	if err != nil {
		p.log.WithFields(logrus.Fields{"wiki": wiki, "type": "tournaments_finished"}).WithError(err).Warn("Failed to refresh")
	}
}
