package services

import (
	"context"
	"io"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/cache"
)

// What the back-office health screen reads from the service and the poller.

func newTestPoller(svc *LiquipediaService) *LiquipediaPoller {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return NewLiquipediaPoller(svc, NewDirtyTracker(), nil, logger)
}

func TestPollerRecordsOnlyRealFetches(t *testing.T) {
	var calls atomic.Int32
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	p := newTestPoller(svc)
	ctx := context.Background()
	require.Empty(t, p.ListRefreshTimes())

	before := time.Now()
	p.refreshMatchesRunning(ctx, "valorant")
	first, ok := p.ListRefreshTimes()["valorant"][ListMatchesRunning]
	require.True(t, ok)
	require.False(t, first.Before(before))
	require.Len(t, p.ListRefreshTimes(), 1)

	// The key is still alive: the refresh makes no call, so nothing was refreshed.
	p.refreshMatchesRunning(ctx, "valorant")
	require.Equal(t, int32(1), calls.Load())
	require.Equal(t, first, p.ListRefreshTimes()["valorant"][ListMatchesRunning])

	// Once the key is gone, the next refresh is a fetch.
	mr.FastForward(TTLMatchesRunning + time.Second)
	svc.GetCache().Del(ctx, cache.LiqMatchesRunningKey("valorant"))
	p.refreshMatchesRunning(ctx, "valorant")
	require.Equal(t, int32(2), calls.Load())
	require.True(t, p.ListRefreshTimes()["valorant"][ListMatchesRunning].After(first))

	// An on-demand key is not a poller list.
	_, err := svc.MakeRequest(ctx, "valorant", "match", nil, cache.LiqMatchesByDateKey("valorant", "2026-11-25"), time.Minute)
	require.NoError(t, err)
	require.Len(t, p.ListRefreshTimes()["valorant"], 1)
}

func TestPollerDatesAListFoundAliveAfterARestart(t *testing.T) {
	var calls atomic.Int32
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	// The previous process fetched the list 8 minutes ago: 5 of its 13 minutes are left.
	key := cache.LiqMatchesRunningKey("dota2")
	require.NoError(t, mr.Set(key, `{"result":[]}`))
	mr.SetTTL(key, 5*time.Minute)

	p := newTestPoller(svc)
	p.refreshMatchesRunning(context.Background(), "dota2")
	require.Equal(t, int32(0), calls.Load())
	at, ok := p.ListRefreshTimes()["dota2"][ListMatchesRunning]
	require.True(t, ok)
	require.InDelta(t, (8 * time.Minute).Seconds(), time.Since(at).Seconds(), 2)
}

func TestPollerRecordsNothingWhenLiquipediaFails(t *testing.T) {
	svc, mr := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	// A stale copy is served, which is not a refresh.
	require.NoError(t, mr.Set(cache.StaleKey(cache.LiqMatchesUpcomingKey("valorant")), `{"result":[]}`))
	p := newTestPoller(svc)
	require.True(t, svc.LastRateLimitedAt().IsZero())

	before := time.Now()
	p.refreshMatchesUpcoming(context.Background(), "valorant")
	require.Empty(t, p.ListRefreshTimes())
	require.False(t, svc.LastRateLimitedAt().Before(before.Truncate(time.Millisecond)))
}

func TestPollerStartedAtAndConfigured(t *testing.T) {
	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))
	require.True(t, svc.Configured())
	p := newTestPoller(svc)
	require.True(t, p.StartedAt().IsZero())
	require.False(t, p.WebhooksEnabled())
	p.SetWebhooksEnabled(true)
	require.True(t, p.WebhooksEnabled())

	// Without a key Start gives up: the poller never ran.
	svc.apiKey = ""
	require.False(t, svc.Configured())
	p.Start(context.Background())
	require.True(t, p.StartedAt().IsZero())
	p.Stop()
}

func TestBudgetWarnReachedMatchesTheLogThreshold(t *testing.T) {
	require.False(t, BudgetWarnReached(799, 1000))
	require.True(t, BudgetWarnReached(800, 1000))
	require.False(t, BudgetWarnReached(7, 10))
	require.True(t, BudgetWarnReached(8, 10))
	require.False(t, BudgetWarnReached(0, 0))
	b := &RequestBudget{Limit: 1000}
	require.Equal(t, BudgetWarnReached(b.warnThreshold(), b.Limit), true)
	require.Equal(t, BudgetWarnReached(b.warnThreshold()-1, b.Limit), false)
}
