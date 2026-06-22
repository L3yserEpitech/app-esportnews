package handlers

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
)

const (
	proxyUserAgent     = "EsportNews/1.0 (contact@esportnews.fr)"
	proxyMaxBytes      = 5 * 1024 * 1024 // 5 MB max
	proxyCacheSecs     = 604800          // 7 days browser cache — logos rarely change
	proxyTimeout       = 10 * time.Second
	maxConcurrentProxy = 100                  // bulk warm-up: fetch a full page of logos truly in parallel
	memoryCacheMaxSize = 500                  // max images to keep in memory cache
	throttleBackoff    = 10 * time.Second     // backoff when upstream returns 429 (rare: image files aren't rate-limited)
	fetchInterval      = 0 * time.Millisecond // global pacing DISABLED — Liquipedia image files aren't rate-limited (verified); set > 0 to re-enable
	semaphoreWait      = 15 * time.Second     // max time to wait for semaphore before returning placeholder

	// redisImageMaxBytes caps which images go to the shared Redis L2 cache.
	// Logos are a few KB–hundreds of KB; anything larger stays L1-only.
	redisImageMaxBytes = 1 * 1024 * 1024
	redisImageTTL      = 7 * 24 * time.Hour
)

// errProxyUnavailable signals the caller (GET handler) to serve the placeholder.
var errProxyUnavailable = errors.New("image upstream unavailable")

// allowedHosts restricts which domains can be proxied (security).
var allowedHosts = map[string]bool{
	"liquipedia.net":     true,
	"www.liquipedia.net": true,
}

// cachedImage stores a proxied image in memory.
type cachedImage struct {
	contentType string
	data        []byte
	cachedAt    time.Time
}

// ImageProxyHandler reverse-proxies images that block hotlinking (liquipedia.net).
// Two cache tiers front the upstream: L1 in-memory (fastest) and L2 Redis (shared
// across instances + survives restarts), so an image is fetched from Liquipedia
// at most once globally and served instantly thereafter.
//
//	GET  /api/proxy/image?url=https://liquipedia.net/commons/...
//	POST /api/proxy/prewarm   { "urls": [ ... ] }   — parallel cache warm-up
type ImageProxyHandler struct {
	semaphore      chan struct{}
	cache          sync.Map          // url hash → *cachedImage (L1)
	redisCache     *cache.RedisCache // L2 (optional)
	throttledUntil atomic.Int64      // unix timestamp — if set, all fetches are paused
	lastFetch      atomic.Int64      // unix nanos of last upstream fetch (rate pacing)
	fetchMu        sync.Mutex        // serializes upstream fetches for pacing
	httpClient     *http.Client      // shared client with IPv6-preferred dialer
}

func NewImageProxyHandler(redisCache *cache.RedisCache) *ImageProxyHandler {
	// Keep-alive + connection pooling to liquipedia.net so bulk logo fetches
	// reuse TLS connections instead of a fresh handshake per image. The dialer
	// is dual-stack (Happy Eyeballs) — IPv6 is used when reachable.
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout: 5 * time.Second,
		}).DialContext,
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 100,
		IdleConnTimeout:     90 * time.Second,
		ForceAttemptHTTP2:   true,
	}

	return &ImageProxyHandler{
		semaphore:  make(chan struct{}, maxConcurrentProxy),
		redisCache: redisCache,
		httpClient: &http.Client{
			Timeout:   proxyTimeout,
			Transport: transport,
		},
	}
}

func (h *ImageProxyHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/proxy/image", h.ProxyImage)
	g.POST("/proxy/prewarm", h.Prewarm)
}

// 1×1 transparent PNG (67 bytes) — returned when upstream is unavailable.
var transparentPixel = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
	0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
	0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00,
	0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
	0x60, 0x82,
}

func (h *ImageProxyHandler) servePlaceholder(c echo.Context) error {
	c.Response().Header().Set("Content-Type", "image/png")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	c.Response().Header().Set("X-Cache", "PLACEHOLDER")
	return c.Blob(http.StatusOK, "image/png", transparentPixel)
}

// validateImageURL returns the cache key for an allowed https liquipedia URL.
func validateImageURL(rawURL string) (cacheKey string, ok bool) {
	if !strings.HasPrefix(rawURL, "https://") {
		return "", false
	}
	hostPart := strings.TrimPrefix(rawURL, "https://")
	slashIdx := strings.Index(hostPart, "/")
	if slashIdx < 0 {
		return "", false
	}
	host := strings.ToLower(hostPart[:slashIdx])
	if !allowedHosts[host] {
		return "", false
	}
	return fmt.Sprintf("%x", sha256.Sum256([]byte(rawURL))), true
}

func (h *ImageProxyHandler) ProxyImage(c echo.Context) error {
	rawURL := c.QueryParam("url")
	if rawURL == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "url parameter required"})
	}

	cacheKey, ok := validateImageURL(rawURL)
	if !ok {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "host not allowed or invalid url"})
	}

	ctx := c.Request().Context()

	// L1 (in-memory)
	if img := h.l1Get(cacheKey); img != nil {
		return h.serveImage(c, img, "HIT")
	}

	// L2 (Redis, shared + persistent)
	if img := h.redisGet(ctx, cacheKey); img != nil {
		h.cache.Store(cacheKey, img) // promote to L1
		return h.serveImage(c, img, "HIT-L2")
	}

	// Cold: fetch from upstream.
	img, err := h.fetchAndStore(ctx, rawURL, cacheKey)
	if err != nil {
		return h.servePlaceholder(c)
	}
	return h.serveImage(c, img, "MISS")
}

// Prewarm fetches a batch of image URLs into the cache in parallel, so the
// browser's subsequent <img> requests are all instant cache hits. Already-cached
// URLs are skipped. Returns counts.
func (h *ImageProxyHandler) Prewarm(c echo.Context) error {
	var body struct {
		URLs []string `json:"urls"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
	}

	ctx := c.Request().Context()
	var warmed, cached, failed int32
	var wg sync.WaitGroup
	seen := make(map[string]bool, len(body.URLs))

	for _, u := range body.URLs {
		cacheKey, ok := validateImageURL(u)
		if !ok || seen[cacheKey] {
			continue
		}
		seen[cacheKey] = true

		if h.l1Get(cacheKey) != nil {
			cached++
			continue
		}
		if img := h.redisGet(ctx, cacheKey); img != nil {
			h.cache.Store(cacheKey, img)
			cached++
			continue
		}

		wg.Add(1)
		go func(url, key string) {
			defer wg.Done()
			if _, err := h.fetchAndStore(ctx, url, key); err != nil {
				atomic.AddInt32(&failed, 1)
			} else {
				atomic.AddInt32(&warmed, 1)
			}
		}(u, cacheKey)
	}

	wg.Wait()
	return c.JSON(http.StatusOK, map[string]int{
		"warmed": int(warmed),
		"cached": int(cached),
		"failed": int(failed),
	})
}

func (h *ImageProxyHandler) serveImage(c echo.Context, img *cachedImage, xcache string) error {
	c.Response().Header().Set("Content-Type", img.contentType)
	c.Response().Header().Set("Cache-Control", "public, max-age=604800, immutable")
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	c.Response().Header().Set("X-Cache", xcache)
	return c.Blob(http.StatusOK, img.contentType, img.data)
}

// l1Get returns a fresh in-memory image or nil (evicting stale entries).
func (h *ImageProxyHandler) l1Get(cacheKey string) *cachedImage {
	cached, ok := h.cache.Load(cacheKey)
	if !ok {
		return nil
	}
	img := cached.(*cachedImage)
	if time.Since(img.cachedAt) >= 7*24*time.Hour {
		h.cache.Delete(cacheKey)
		return nil
	}
	return img
}

const redisImagePrefix = "liq:img:"

func (h *ImageProxyHandler) redisGet(ctx context.Context, cacheKey string) *cachedImage {
	if h.redisCache == nil {
		return nil
	}
	val, err := h.redisCache.Get(ctx, redisImagePrefix+cacheKey)
	if err != nil || val == "" {
		return nil
	}
	nl := strings.IndexByte(val, '\n')
	if nl < 0 {
		return nil
	}
	return &cachedImage{contentType: val[:nl], data: []byte(val[nl+1:]), cachedAt: time.Now()}
}

func (h *ImageProxyHandler) redisStore(ctx context.Context, cacheKey string, img *cachedImage) {
	if h.redisCache == nil || len(img.data) > redisImageMaxBytes {
		return
	}
	// value = "<content-type>\n<raw bytes>" (content-type never contains a newline)
	val := img.contentType + "\n" + string(img.data)
	// Detach from the request context so the write completes even if the client
	// disconnects right after receiving the bytes.
	storeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
	defer cancel()
	_ = h.redisCache.Set(storeCtx, redisImagePrefix+cacheKey, val, redisImageTTL)
}

// fetchAndStore fetches the image from upstream and populates both cache tiers.
func (h *ImageProxyHandler) fetchAndStore(ctx context.Context, rawURL, cacheKey string) (*cachedImage, error) {
	// Skip while globally throttled by a recent upstream 429.
	if ts := h.throttledUntil.Load(); ts > 0 {
		if time.Now().Unix() < ts {
			return nil, errProxyUnavailable
		}
		h.throttledUntil.Store(0)
	}

	select {
	case h.semaphore <- struct{}{}:
		defer func() { <-h.semaphore }()
	case <-time.After(semaphoreWait):
		return nil, errProxyUnavailable
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Optional global pacing (disabled by default — fetchInterval == 0).
	if fetchInterval > 0 {
		h.fetchMu.Lock()
		lastNanos := h.lastFetch.Load()
		if lastNanos > 0 {
			if elapsed := time.Since(time.Unix(0, lastNanos)); elapsed < fetchInterval {
				time.Sleep(fetchInterval - elapsed)
			}
		}
		h.lastFetch.Store(time.Now().UnixNano())
		h.fetchMu.Unlock()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, errProxyUnavailable
	}
	req.Header.Set("User-Agent", proxyUserAgent)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, errProxyUnavailable
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		h.throttledUntil.Store(time.Now().Add(throttleBackoff).Unix())
		return nil, errProxyUnavailable
	}
	if resp.StatusCode != http.StatusOK {
		return nil, errProxyUnavailable
	}

	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		return nil, errProxyUnavailable
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, proxyMaxBytes))
	if err != nil {
		return nil, errProxyUnavailable
	}

	img := &cachedImage{contentType: ct, data: data, cachedAt: time.Now()}
	h.cache.Store(cacheKey, img)     // L1
	h.redisStore(ctx, cacheKey, img) // L2 (best-effort)
	return img, nil
}
