package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

// WebhookHandler receives LiquipediaDB webhook events and marks dirty flags
// for the poller to consume. It never calls the API directly — the debounce
// is handled by the poller's dirty flag consumer.
type WebhookHandler struct {
	dirtyTracker *services.DirtyTracker
	log          *logrus.Logger
}

// NewWebhookHandler creates a new webhook handler.
func NewWebhookHandler(dirtyTracker *services.DirtyTracker, logger *logrus.Logger) *WebhookHandler {
	return &WebhookHandler{
		dirtyTracker: dirtyTracker,
		log:          logger,
	}
}

// RegisterRoutes registers the webhook endpoint.
func (h *WebhookHandler) RegisterRoutes(g RouterGroup) {
	g.POST("/webhooks/liquipedia", h.HandleLiquipediaWebhook)
}

// HandleLiquipediaWebhook receives a webhook from LiquipediaDB.
// It parses the event, marks the wiki as dirty, and returns 200 immediately.
// The actual API fetching happens asynchronously in the poller.
func (h *WebhookHandler) HandleLiquipediaWebhook(c echo.Context) error {
	var event models.LiquipediaWebhookEvent
	if err := c.Bind(&event); err != nil {
		h.log.WithError(err).Warn("Invalid webhook payload")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
	}

	// Ignore events outside main content and teamtemplates namespaces
	if event.Namespace != 0 && event.Namespace != -10 {
		return c.NoContent(http.StatusOK)
	}

	// Ignore if wiki is empty or unknown
	if event.Wiki == "" {
		return c.NoContent(http.StatusOK)
	}

	h.log.WithFields(logrus.Fields{
		"wiki":      event.Wiki,
		"event":     event.Event,
		"page":      event.Page,
		"namespace": event.Namespace,
	}).Info("Liquipedia webhook received")

	// Mark dirty — the poller will fetch on its next cycle
	h.dirtyTracker.MarkDirty(event)

	return c.NoContent(http.StatusOK)
}
