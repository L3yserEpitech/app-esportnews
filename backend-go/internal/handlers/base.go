package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/esportnews/backend/internal/cache"
)

// BaseHandler contains common dependencies for all handlers
type BaseHandler struct {
	DB    *pgxpool.Pool
	Cache *cache.RedisCache
}

// RouterGroup defines the interface for handler route registration
type RouterGroup interface {
	GET(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc) *echo.Route
	POST(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc) *echo.Route
	PUT(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc) *echo.Route
	PATCH(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc) *echo.Route
	DELETE(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc) *echo.Route
}

// Handler interface for all handlers
type Handler interface {
	RegisterRoutes(g RouterGroup)
}
