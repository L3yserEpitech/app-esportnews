package handlers

import (
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

const (
	proxyUserAgent   = "EsportNews/1.0 (contact@esportnews.fr)"
	proxyMaxBytes    = 5 * 1024 * 1024 // 5 MB max
	proxyCacheSecs   = 86400           // 24h browser cache
	proxyTimeout     = 10 * time.Second
)

// allowedHosts restricts which domains can be proxied (security).
var allowedHosts = map[string]bool{
	"liquipedia.net":     true,
	"www.liquipedia.net": true,
}

// ImageProxyHandler serves as a reverse-proxy for images that block hotlinking
// (e.g. liquipedia.net). The backend fetches the image with the proper User-Agent
// and streams it back to the browser.
//
//	GET /api/proxy/image?url=https://liquipedia.net/commons/...
type ImageProxyHandler struct{}

func NewImageProxyHandler() *ImageProxyHandler {
	return &ImageProxyHandler{}
}

func (h *ImageProxyHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/proxy/image", h.ProxyImage)
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
	// Extract host from URL (between "https://" and the next "/")
	hostPart := strings.TrimPrefix(rawURL, "https://")
	slashIdx := strings.Index(hostPart, "/")
	if slashIdx < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid url"})
	}
	host := strings.ToLower(hostPart[:slashIdx])

	if !allowedHosts[host] {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "host not allowed"})
	}

	// Fetch upstream
	client := &http.Client{Timeout: proxyTimeout}
	req, err := http.NewRequestWithContext(c.Request().Context(), http.MethodGet, rawURL, nil)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid url"})
	}
	req.Header.Set("User-Agent", proxyUserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "upstream fetch failed"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(resp.StatusCode, map[string]string{"error": "upstream returned " + resp.Status})
	}

	// Validate content-type is an image
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "not an image"})
	}

	// Stream response with caching headers
	c.Response().Header().Set("Content-Type", ct)
	c.Response().Header().Set("Cache-Control", "public, max-age=86400, immutable")
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		c.Response().Header().Set("Content-Length", cl)
	}
	c.Response().WriteHeader(http.StatusOK)

	// Copy body with size limit
	_, _ = io.Copy(c.Response(), io.LimitReader(resp.Body, proxyMaxBytes))
	return nil
}
