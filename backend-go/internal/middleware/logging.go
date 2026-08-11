package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

func LoggingMiddleware(logger *logrus.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)

			// Quand un handler *retourne* une erreur, Echo n'écrit le vrai code
			// qu'ensuite, dans son HTTPErrorHandler. Lire Response().Status ici
			// donnait donc 200 sur toutes les requêtes en échec : les logs
			// annonçaient un succès pendant que le client recevait une 500.
			status := c.Response().Status
			if err != nil {
				if he, ok := err.(*echo.HTTPError); ok {
					status = he.Code
				} else {
					status = http.StatusInternalServerError
				}
			}

			entry := logger.WithFields(logrus.Fields{
				"method": c.Request().Method,
				"path":   c.Request().URL.Path,
				"status": status,
				"ip":     c.RealIP(),
			})
			if err != nil {
				entry.WithError(err).Warn("Request failed")
				return err
			}
			entry.Info("Request processed")

			return nil
		}
	}
}
