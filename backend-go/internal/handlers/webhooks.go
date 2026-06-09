package handlers

import (
	"crypto/subtle"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

// Valid webhook event types from LiquipediaDB
var validWebhookEvents = map[string]bool{
	"edit":   true,
	"delete": true,
	"move":   true,
	"purge":  true,
}

// webhookSecretHeader carries the shared secret on manual/test deliveries.
// webhookSecretQueryParam carries it on real LiquipediaDB deliveries: the
// dashboard offers no way to set custom headers (only a URL + comment), and
// the payload has no signature, so the secret must travel in the webhook URL.
const (
	webhookSecretHeader     = "X-Webhook-Secret"
	webhookSecretQueryParam = "secret"
)

// WebhookHandler receives LiquipediaDB webhook events and marks dirty flags
// for the poller to consume. It never calls the API directly — the debounce
// is handled by the poller's dirty flag consumer.
type WebhookHandler struct {
	dirtyTracker *services.DirtyTracker
	secret       string
	log          *logrus.Logger
}

// NewWebhookHandler creates a new webhook handler. A non-empty secret enables
// constant-time validation of the X-Webhook-Secret header on each request;
// an empty secret disables the check (intended for local development only).
func NewWebhookHandler(dirtyTracker *services.DirtyTracker, secret string, logger *logrus.Logger) *WebhookHandler {
	return &WebhookHandler{
		dirtyTracker: dirtyTracker,
		secret:       secret,
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
	if !h.authorized(c) {
		h.log.Warn("Webhook rejected: invalid or missing secret")
		return c.JSON(http.StatusForbidden, map[string]string{"error": "forbidden"})
	}

	var event models.LiquipediaWebhookEvent
	if err := c.Bind(&event); err != nil {
		h.log.WithError(err).Warn("Invalid webhook payload")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
	}

	// Fix #14: Validate event type
	if event.Event != "" && !validWebhookEvents[event.Event] {
		h.log.WithField("event", event.Event).Warn("Unknown webhook event type")
		return c.NoContent(http.StatusOK)
	}

	// Ignore events outside main content and teamtemplates namespaces
	if event.Namespace != 0 && event.Namespace != -10 {
		h.log.WithFields(logrus.Fields{
			"wiki":      event.Wiki,
			"namespace": event.Namespace,
			"page":      event.Page,
		}).Info("[WEBHOOK] Ignored — namespace not 0 or -10")
		return c.NoContent(http.StatusOK)
	}

	// Fix #14: Validate wiki is known
	if event.Wiki == "" {
		return c.NoContent(http.StatusOK)
	}
	if _, known := models.WikiToAcronym[event.Wiki]; !known {
		h.log.WithField("wiki", event.Wiki).Debug("Webhook from unknown wiki, ignoring")
		return c.NoContent(http.StatusOK)
	}

	h.log.WithFields(logrus.Fields{
		"wiki":      event.Wiki,
		"event":     event.Event,
		"page":      event.Page,
		"namespace": event.Namespace,
	}).Info("[WEBHOOK] ✅ Received and accepted — marking dirty")

	// Mark dirty — the poller will fetch on its next cycle
	h.dirtyTracker.MarkDirty(event)

	h.log.WithFields(logrus.Fields{
		"wiki":      event.Wiki,
		"namespace": event.Namespace,
	}).Info("[WEBHOOK] Dirty flags set — poller will consume on next cycle")

	return c.NoContent(http.StatusOK)
}

// authorized reports whether the incoming request carries a valid secret.
// When no secret is configured (h.secret == ""), the check is disabled.
// The secret is read from the X-Webhook-Secret header first (manual tests),
// then from the `secret` query param (real LiquipediaDB deliveries), and
// compared in constant time to avoid leaking byte-level timing information.
func (h *WebhookHandler) authorized(c echo.Context) bool {
	if h.secret == "" {
		return true
	}
	provided := c.Request().Header.Get(webhookSecretHeader)
	if provided == "" {
		provided = c.QueryParam(webhookSecretQueryParam)
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(h.secret)) == 1
}
