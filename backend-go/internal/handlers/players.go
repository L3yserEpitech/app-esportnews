package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
)

type PlayerHandler struct {
	BaseHandler
	liquipediaService *services.LiquipediaService
	log               *logrus.Logger
}

func NewPlayerHandler(liquipediaService *services.LiquipediaService, log *logrus.Logger) *PlayerHandler {
	return &PlayerHandler{liquipediaService: liquipediaService, log: log}
}

func (h *PlayerHandler) RegisterRoutes(g RouterGroup) {
	g.GET("/players/:pagename", h.GetPlayer)
}

// GetPlayer returns a player profile (+ transfers) for a wiki.
// GET /api/players/:pagename?wiki=<wiki|acronym> — wiki required (no 10-wiki scan).
func (h *PlayerHandler) GetPlayer(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
	defer cancel()

	pagename := c.Param("pagename")
	if decoded, err := url.PathUnescape(pagename); err == nil {
		pagename = decoded
	}
	if pagename == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "player pagename required"})
	}

	wikiParam := c.QueryParam("wiki")
	if wikiParam == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "wiki query parameter required"})
	}
	wiki, ok := models.GameWikiMapping[wikiParam]
	if !ok {
		if _, exists := models.WikiToAcronym[wikiParam]; exists {
			wiki = wikiParam
		} else {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "unknown game/wiki: " + wikiParam})
		}
	}

	player, err := h.liquipediaService.GetPlayerByPagename(ctx, wiki, pagename)
	if err != nil {
		if errors.Is(err, services.ErrPlayerNotFound) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "player not found"})
		}
		// Transient upstream failure (429 backoff / budget / network) — 503 so a
		// valid player isn't de-indexed on a blip (same policy as matches).
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "player temporarily unavailable"})
	}

	setPublicCache(c, 300, 600)
	return c.JSON(http.StatusOK, player)
}
