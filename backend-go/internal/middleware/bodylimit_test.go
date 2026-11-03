package middleware

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestBodyLimit(t *testing.T) {
	e := echo.New()
	e.Use(BodyLimit())
	var read int64
	consume := func(c echo.Context) error {
		n, err := io.Copy(io.Discard, c.Request().Body)
		read = n
		if err != nil {
			return err
		}
		return c.NoContent(http.StatusOK)
	}
	e.POST("/api/analytics/track", consume)
	e.POST("/api/webhooks/stripe", consume)
	e.POST("/api/admin/articles", consume)
	e.POST("/api/auth/avatar/upload", consume)

	post := func(path string, body io.Reader) int {
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, body))
		return rec.Code
	}
	const big = 2 << 20

	assert.Equal(t, http.StatusOK, post("/api/analytics/track", strings.NewReader(`{"path":"/"}`)))
	assert.Equal(t, http.StatusRequestEntityTooLarge, post("/api/analytics/track", bytes.NewReader(make([]byte, big))))

	// Chunked: no Content-Length to refuse on, the limit has to bite on read.
	read = 0
	assert.Equal(t, http.StatusRequestEntityTooLarge, post("/api/webhooks/stripe", io.MultiReader(bytes.NewReader(make([]byte, big)))))
	assert.LessOrEqual(t, read, int64(publicBodyLimitBytes+32*1024))

	// Authenticates before reading a byte, and legitimately carries files.
	assert.Equal(t, http.StatusOK, post("/api/admin/articles", bytes.NewReader(make([]byte, big))))

	// Any free account can reach this one: above what an avatar may weigh, no read.
	assert.Equal(t, http.StatusOK, post("/api/auth/avatar/upload", bytes.NewReader(make([]byte, big))))
	assert.Equal(t, http.StatusRequestEntityTooLarge, post("/api/auth/avatar/upload", bytes.NewReader(make([]byte, 12<<20))))
}
