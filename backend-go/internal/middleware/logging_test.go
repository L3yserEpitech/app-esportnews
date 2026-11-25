package middleware

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

// The back-office reads this counter for « Réponses 5xx · 24 h ».
func TestLoggingCountsServerErrors(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	e := echo.New()
	e.Use(LoggingMiddleware(logger))
	e.GET("/ok", func(c echo.Context) error { return c.NoContent(http.StatusOK) })
	e.GET("/missing", func(c echo.Context) error { return c.NoContent(http.StatusNotFound) })
	e.GET("/written", func(c echo.Context) error {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "upstream"})
	})
	e.GET("/returned", func(c echo.Context) error { return echo.NewHTTPError(http.StatusBadGateway, "bad gateway") })
	e.GET("/refused", func(c echo.Context) error { return echo.NewHTTPError(http.StatusForbidden, "forbidden") })
	e.GET("/plain", func(c echo.Context) error { return errors.New("boom") })

	hit := func(path string) {
		e.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}
	start := ServerErrorCount()
	for _, path := range []string{"/ok", "/missing", "/refused", "/nowhere"} {
		hit(path)
	}
	require.Equal(t, start, ServerErrorCount())

	for _, path := range []string{"/written", "/returned", "/plain"} {
		hit(path)
	}
	require.Equal(t, start+3, ServerErrorCount())
}
