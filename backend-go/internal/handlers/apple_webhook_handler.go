package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/services"
)

// AppleWebhookHandler receives App Store Server Notifications V2. Apple POSTs
// a signed JWS whenever a subscription is created, renewed, refunded, expired,
// etc. This handler has NO user auth — authenticity is enforced by verifying
// Apple's signature against their root CA inside IAPService.
//
// Reference: https://developer.apple.com/documentation/appstoreservernotifications
type AppleWebhookHandler struct {
	iapService *services.IAPService
	logger     *logrus.Logger
}

func NewAppleWebhookHandler(iapService *services.IAPService, logger *logrus.Logger) *AppleWebhookHandler {
	return &AppleWebhookHandler{
		iapService: iapService,
		logger:     logger,
	}
}

// RegisterRoutes registers the Apple webhook route (public, no JWT).
func (h *AppleWebhookHandler) RegisterRoutes(g *echo.Group) {
	g.POST("/webhooks/apple", h.HandleNotification)
}

type appleNotificationBody struct {
	SignedPayload string `json:"signedPayload"`
}

// HandleNotification receives and processes an App Store Server Notification.
// We return 200 on recoverable errors so Apple doesn't retry forever on a
// transient DB hiccup. We only return 400 on malformed bodies / missing
// signedPayload so misconfigurations are visible in monitoring.
func (h *AppleWebhookHandler) HandleNotification(c echo.Context) error {
	body, err := io.ReadAll(io.LimitReader(c.Request().Body, 64*1024))
	if err != nil {
		h.logger.Errorf("[IAP][Webhook] Failed to read body: %v", err)
		return c.NoContent(http.StatusBadRequest)
	}

	var req appleNotificationBody
	if err := json.Unmarshal(body, &req); err != nil {
		h.logger.Errorf("[IAP][Webhook] Malformed JSON: %v", err)
		return c.NoContent(http.StatusBadRequest)
	}

	if req.SignedPayload == "" {
		h.logger.Warn("[IAP][Webhook] Empty signedPayload")
		return c.NoContent(http.StatusBadRequest)
	}

	if err := h.iapService.HandleAppleNotification(c.Request().Context(), req.SignedPayload); err != nil {
		h.logger.Errorf("[IAP][Webhook] Processing failed: %v", err)
		return c.NoContent(http.StatusOK)
	}

	return c.NoContent(http.StatusOK)
}
