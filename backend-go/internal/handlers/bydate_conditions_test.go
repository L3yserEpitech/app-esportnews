package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

func TestListTournamentsByDateOnDemandExcludesCalledOffTournaments(t *testing.T) {
	var conditions atomic.Value
	th, _, _ := newDetailHandlers(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conditions.Store(r.URL.Query().Get("conditions"))
		_, _ = w.Write([]byte(`{"result":[]}`))
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/tournaments/by-date", strings.NewReader("date=2025-01-15&game=csgo"))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)
	rec := httptest.NewRecorder()
	require.NoError(t, th.ListTournamentsByDate(echo.New().NewContext(req, rec)))

	require.Equal(t, http.StatusOK, rec.Code)
	want := "[[startdate::<2025-01-16]] AND [[enddate::>2025-01-14]] AND [[status::!cancelled]] AND [[status::!postponed]]"
	require.Equal(t, want, conditions.Load())
}
