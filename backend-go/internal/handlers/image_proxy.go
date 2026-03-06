package handlers

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/labstack/echo/v4"
)

const (
	proxyUserAgent     = "EsportNews/1.0 (contact@esportnews.fr)"
	proxyMaxBytes      = 5 * 1024 * 1024 // 5 MB max
	proxyCacheSecs     = 86400           // 24h browser cache
	proxyTimeout       = 10 * time.Second
	maxConcurrentProxy = 2               // max concurrent outbound image fetches
	memoryCacheMaxSize = 500             // max images to keep in memory cache
	throttleBackoff    = 10 * time.Second // backoff when upstream returns 429
	fetchInterval      = 200 * time.Millisecond // min delay between upstream fetches (5 req/s max)
	semaphoreWait      = 3 * time.Second // max time to wait for semaphore before returning placeholder
)

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

// ImageProxyHandler serves as a reverse-proxy for images that block hotlinking
// (e.g. liquipedia.net). The backend fetches the image with the proper User-Agent
// and streams it back to the browser.
//
//	GET /api/proxy/image?url=https://liquipedia.net/commons/...
type ImageProxyHandler struct {
	semaphore      chan struct{}
	cache          sync.Map     // url hash → *cachedImage
	cacheSize      int64        // approximate count
	throttledUntil atomic.Int64 // unix timestamp — if set, all fetches are paused
	lastFetch      atomic.Int64 // unix nanos of last upstream fetch (rate pacing)
	fetchMu        sync.Mutex   // serializes upstream fetches for pacing
	httpClient     *http.Client // shared client with IPv6-preferred dialer
}

func NewImageProxyHandler() *ImageProxyHandler {
	// Custom dialer that prefers IPv6 — Liquipedia rate-limits IPv4 more aggressively
	dialer := &net.Dialer{
		Timeout:   5 * time.Second,
		KeepAlive: -1, // disable keep-alive
	}
	transport := &http.Transport{
		DisableKeepAlives: true,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// Try IPv6 first
			conn, err := dialer.DialContext(ctx, "tcp6", addr)
			if err == nil {
				return conn, nil
			}
			// Fallback to IPv4
			return dialer.DialContext(ctx, "tcp4", addr)
		},
	}

	return &ImageProxyHandler{
		semaphore: make(chan struct{}, maxConcurrentProxy),
		httpClient: &http.Client{
			Timeout:   proxyTimeout,
			Transport: transport,
		},
	}
}

func (h *ImageProxyHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/proxy/image", h.ProxyImage)
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

func (h *ImageProxyHandler) ProxyImage(c echo.Context) error {
	rawURL := c.QueryParam("url")
	if rawURL == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "url parameter required"})
	}

	// Validate scheme
	if !strings.HasPrefix(rawURL, "https://") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "only https urls allowed"})
	}

	// Validate host against allowlist
	hostPart := strings.TrimPrefix(rawURL, "https://")
	slashIdx := strings.Index(hostPart, "/")
	if slashIdx < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid url"})
	}
	host := strings.ToLower(hostPart[:slashIdx])

	if !allowedHosts[host] {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "host not allowed"})
	}

	// Check in-memory cache first
	cacheKey := fmt.Sprintf("%x", sha256.Sum256([]byte(rawURL)))
	if cached, ok := h.cache.Load(cacheKey); ok {
		img := cached.(*cachedImage)
		if time.Since(img.cachedAt) < 24*time.Hour {
			c.Response().Header().Set("Content-Type", img.contentType)
			c.Response().Header().Set("Cache-Control", "public, max-age=86400, immutable")
			c.Response().Header().Set("Access-Control-Allow-Origin", "*")
			c.Response().Header().Set("X-Cache", "HIT")
			return c.Blob(http.StatusOK, img.contentType, img.data)
		}
		h.cache.Delete(cacheKey)
	}

	// If upstream is throttled (recent 429), return placeholder immediately
	if throttleTS := h.throttledUntil.Load(); throttleTS > 0 {
		if time.Now().Unix() < throttleTS {
			return h.servePlaceholder(c)
		}
		h.throttledUntil.Store(0)
	}

	// Acquire semaphore with timeout — don't block forever
	select {
	case h.semaphore <- struct{}{}:
		defer func() { <-h.semaphore }()
	case <-time.After(semaphoreWait):
		return h.servePlaceholder(c)
	case <-c.Request().Context().Done():
		return h.servePlaceholder(c)
	}

	// Rate pacing: ensure minimum interval between upstream fetches
	h.fetchMu.Lock()
	lastNanos := h.lastFetch.Load()
	if lastNanos > 0 {
		elapsed := time.Since(time.Unix(0, lastNanos))
		if elapsed < fetchInterval {
			time.Sleep(fetchInterval - elapsed)
		}
	}
	h.lastFetch.Store(time.Now().UnixNano())
	h.fetchMu.Unlock()

	// Fetch upstream using shared client (IPv6-preferred, no keep-alive)
	req, err := http.NewRequestWithContext(c.Request().Context(), http.MethodGet, rawURL, nil)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid url"})
	}
	req.Header.Set("User-Agent", proxyUserAgent)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return h.servePlaceholder(c)
	}
	defer resp.Body.Close()

	// Handle upstream rate limiting — back off globally
	if resp.StatusCode == http.StatusTooManyRequests {
		h.throttledUntil.Store(time.Now().Add(throttleBackoff).Unix())
		return h.servePlaceholder(c)
	}

	if resp.StatusCode != http.StatusOK {
		return h.servePlaceholder(c)
	}

	// Validate content-type is an image
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		return h.servePlaceholder(c)
	}

	// Read body into memory (for caching + serving)
	data, err := io.ReadAll(io.LimitReader(resp.Body, proxyMaxBytes))
	if err != nil {
		return h.servePlaceholder(c)
	}

	// Store in memory cache
	h.cache.Store(cacheKey, &cachedImage{
		contentType: ct,
		data:        data,
		cachedAt:    time.Now(),
	})

	// Stream response with caching headers
	c.Response().Header().Set("Content-Type", ct)
	c.Response().Header().Set("Cache-Control", "public, max-age=86400, immutable")
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	c.Response().Header().Set("X-Cache", "MISS")
	return c.Blob(http.StatusOK, ct, data)
}
