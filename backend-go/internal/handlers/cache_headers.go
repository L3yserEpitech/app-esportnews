package handlers

import (
	"fmt"

	"github.com/labstack/echo/v4"
)

// setPublicCache marks a shared (same-for-everyone) 200 response as CDN/browser
// cacheable. Never call it on authenticated or per-user routes.
func setPublicCache(c echo.Context, maxAge, swr int) {
	value := fmt.Sprintf("public, max-age=%d", maxAge)
	if swr > 0 {
		value += fmt.Sprintf(", stale-while-revalidate=%d", swr)
	}
	c.Response().Header().Set("Cache-Control", value)
}
