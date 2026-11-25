package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/services"
)

func postWebhook(t *testing.T, h *WebhookHandler, secret, body string) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/webhooks/liquipedia", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if secret != "" {
		req.Header.Set(webhookSecretHeader, secret)
	}
	rec := httptest.NewRecorder()
	require.NoError(t, h.HandleLiquipediaWebhook(echo.New().NewContext(req, rec)))
	return rec.Code
}

// The health screen shows, per wiki, the last webhook that marked it dirty.
func TestWebhookRemembersTheLastAcceptedDeliveryPerWiki(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	h := NewWebhookHandler(services.NewDirtyTracker(), "s3cret", logger)
	require.Empty(t, h.LastReceived())

	before := time.Now()
	require.Equal(t, http.StatusOK, postWebhook(t, h, "s3cret", `{"page":"Match:A_vs_B","namespace":0,"wiki":"valorant","event":"edit"}`))
	got := h.LastReceived()
	require.Len(t, got, 1)
	require.False(t, got["valorant"].Before(before))

	// Refused, ignored or unknown deliveries leave no trace.
	require.Equal(t, http.StatusForbidden, postWebhook(t, h, "wrong", `{"page":"X","namespace":0,"wiki":"dota2","event":"edit"}`))
	require.Equal(t, http.StatusOK, postWebhook(t, h, "s3cret", `{"page":"Main_Page","namespace":0,"wiki":"dota2","event":"purge"}`))
	require.Equal(t, http.StatusOK, postWebhook(t, h, "s3cret", `{"page":"X","namespace":4,"wiki":"dota2","event":"edit"}`))
	require.Equal(t, http.StatusOK, postWebhook(t, h, "s3cret", `{"page":"X","namespace":0,"wiki":"notawiki","event":"edit"}`))
	require.Len(t, h.LastReceived(), 1)

	// The map handed out is a copy.
	got["dota2"] = time.Now()
	require.Len(t, h.LastReceived(), 1)
}
