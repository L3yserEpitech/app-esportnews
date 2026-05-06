package utils

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

// EchoValidator wraps go-playground/validator/v10 for Echo's c.Validate API.
// Register one shared instance via e.Validator = utils.NewEchoValidator().
type EchoValidator struct {
	v *validator.Validate
}

// NewEchoValidator returns a validator wired up for Echo.
func NewEchoValidator() *EchoValidator {
	return &EchoValidator{v: validator.New(validator.WithRequiredStructEnabled())}
}

// Validate is the method Echo calls from c.Validate(i).
func (e *EchoValidator) Validate(i interface{}) error {
	if err := e.v.Struct(i); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, formatValidationError(err))
	}
	return nil
}

func formatValidationError(err error) string {
	var verrs validator.ValidationErrors
	if !errors.As(err, &verrs) {
		return err.Error()
	}
	parts := make([]string, 0, len(verrs))
	for _, fe := range verrs {
		parts = append(parts, describe(fe))
	}
	return strings.Join(parts, "; ")
}

func describe(fe validator.FieldError) string {
	field := fe.Field()
	switch fe.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", field)
	case "email":
		return fmt.Sprintf("%s must be a valid email address", field)
	case "min":
		return fmt.Sprintf("%s must be at least %s characters", field, fe.Param())
	case "max":
		return fmt.Sprintf("%s must be at most %s characters", field, fe.Param())
	default:
		return fmt.Sprintf("%s failed %s validation", field, fe.Tag())
	}
}
