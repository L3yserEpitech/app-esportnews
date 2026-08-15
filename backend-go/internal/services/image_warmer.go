package services

import (
	"context"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/imagecache"
)

const warmMaxConcurrent = 16

// ImageWarmer fetches Liquipedia images into the shared Redis cache ahead of
// time, so the image proxy serves them as instant L2 hits — including on a
// user's very first visit. Writes use the same key/format as the proxy reader
// (internal/imagecache), and already-cached images are skipped.
type ImageWarmer struct {
	redis      *cache.RedisCache
	httpClient *http.Client
	sem        chan struct{}
	log        *logrus.Logger
}

func NewImageWarmer(redis *cache.RedisCache, logger *logrus.Logger) *ImageWarmer {
	transport := &http.Transport{
		DialContext:         (&net.Dialer{Timeout: 5 * time.Second}).DialContext,
		MaxIdleConns:        50,
		MaxIdleConnsPerHost: 50,
		IdleConnTimeout:     90 * time.Second,
		ForceAttemptHTTP2:   true,
	}
	return &ImageWarmer{
		redis:      redis,
		httpClient: &http.Client{Timeout: 15 * time.Second, Transport: transport},
		sem:        make(chan struct{}, warmMaxConcurrent),
		log:        logger,
	}
}

// WarmURLs fetches the uncached Liquipedia image URLs into Redis in parallel.
// Best-effort and non-fatal: failures are silently skipped.
func (w *ImageWarmer) WarmURLs(ctx context.Context, urls []string) {
	if w == nil || w.redis == nil || len(urls) == 0 {
		return
	}

	seen := make(map[string]bool, len(urls))
	var wg sync.WaitGroup
	warmed := 0

	for _, u := range urls {
		if u == "" || !imagecache.AllowedHost(u) {
			continue
		}
		key := imagecache.CacheKey(u)
		if seen[key] {
			continue
		}
		seen[key] = true

		if exists, _ := w.redis.Exists(ctx, imagecache.RedisKey(key)); exists {
			continue
		}

		warmed++
		wg.Add(1)
		go func(url, key string) {
			defer wg.Done()
			w.fetchAndStore(ctx, url, key)
		}(u, key)
	}

	wg.Wait()
	if warmed > 0 {
		w.log.WithField("count", warmed).Debug("[IMG-WARM] warmed image cache")
	}
}

func (w *ImageWarmer) fetchAndStore(ctx context.Context, url, key string) {
	select {
	case w.sem <- struct{}{}:
		defer func() { <-w.sem }()
	case <-ctx.Done():
		return
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return
	}
	req.Header.Set("User-Agent", "EsportNews/1.0 (contact@esportnews.fr)")

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return
	}
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		return
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, imagecache.MaxBytes+1))
	if err != nil || int64(len(data)) > imagecache.MaxBytes {
		return
	}

	storeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
	defer cancel()
	_ = w.redis.Set(storeCtx, imagecache.RedisKey(key), imagecache.Encode(ct, data), imagecache.RedisTTL)
}
