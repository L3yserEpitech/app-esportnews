package handlers

import (
	"io"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/services"
)

// GoogleWebhookHandler receives Google Play Real-time Developer Notifications
// delivered by Pub/Sub. Authentication is enforced by a shared secret token in
// the URL query string — configure the Pub/Sub push subscription URL as:
//
//	https://api.esportnews.fr/api/webhooks/google?token=<GOOGLE_WEBHOOK_TOKEN>
//
// Reference: https://developer.android.com/google/play/billing/rtdn-reference
type GoogleWebhookHandler struct {
	iapService *services.IAPService
	logger     *logrus.Logger
	token      string // shared secret; empty = token check disabled (dev only)
}

func NewGoogleWebhookHandler(iapService *services.IAPService, logger *logrus.Logger, token string) *GoogleWebhookHandler {
	return &GoogleWebhookHandler{
		iapService: iapService,
		logger:     logger,
		token:      token,
	}
}

// RegisterRoutes registers the Google Play webhook route (public URL, token-secured).
func (h *GoogleWebhookHandler) RegisterRoutes(g *echo.Group) {
	g.POST("/webhooks/google", h.HandleNotification)
}

// HandleNotification receives and processes a Pub/Sub push message from Google Play.
// Returns 200 on all recoverable errors so Pub/Sub doesn't retry indefinitely on
// transient DB hiccups. Returns 400 only on malformed / unauthenticated requests.
func (h *GoogleWebhookHandler) HandleNotification(c echo.Context) error {
	// Verify shared-secret token (skip only if env var is not set — local dev).
	if h.token != "" && c.QueryParam("token") != h.token {
		h.logger.Warn("[IAP][GoogleWebhook] Rejected request: invalid token")
		return c.NoContent(http.StatusUnauthorized)
	}

	body, err := io.ReadAll(io.LimitReader(c.Request().Body, 64*1024))
	if err != nil {
		h.logger.Errorf("[IAP][GoogleWebhook] Failed to read body: %v", err)
		return c.NoContent(http.StatusBadRequest)
	}

	if len(body) == 0 {
		h.logger.Warn("[IAP][GoogleWebhook] Empty body")
		return c.NoContent(http.StatusBadRequest)
	}

	if err := h.iapService.HandleGoogleNotification(c.Request().Context(), body); err != nil {
		h.logger.Errorf("[IAP][GoogleWebhook] Processing failed: %v", err)
		// Return 200 so Pub/Sub doesn't retry on transient errors.
		return c.NoContent(http.StatusOK)
	}

	return c.NoContent(http.StatusOK)
}
