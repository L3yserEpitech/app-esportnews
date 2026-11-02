package handlers

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/utils"
)

const subTestSecret = "test-secret"

// Set by subscriptionServer, for the tests that end its session.
var subTestCache *cache.RedisCache

// Sauté sans TEST_DATABASE_URL : ces chemins reposent sur l'index partiel Postgres.
func subscriptionServer(t *testing.T) (*gorm.DB, http.Handler, string) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.MatchSubscription{}, &models.TournamentSubscription{}))
	require.NoError(t, database.EnsureMatchSubscriptionIdentity(db))
	require.NoError(t, db.Exec(`TRUNCATE match_subscription, tournament_subscription`).Error)
	require.NoError(t, db.Exec(`DELETE FROM users WHERE email = 'sub-test@example.com'`).Error)

	user := models.User{Email: "sub-test@example.com", Password: "x"}
	require.NoError(t, db.Create(&user).Error)
	token, tokenID, err := utils.GenerateJWT(user.ID, user.Email, false, subTestSecret, time.Hour)
	require.NoError(t, err)
	rc := testCache(t)
	subTestCache = rc
	require.NoError(t, rc.Set(context.Background(), cache.JWTKey(tokenID), "refresh-id", time.Hour))

	e := echo.New()
	auth := services.NewAuthService(nil, rc, subTestSecret)
	NewMatchSubHandler(auth, db).RegisterRoutes(e.Group("/api"))
	return db, e, token
}

func subRequest(t *testing.T, srv http.Handler, token, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func subBody(match2ID string) string {
	return fmt.Sprintf(`{"match_name":"A vs B","match2id":%q,"tournament_name":"T","game_acronym":"cs2"}`, match2ID)
}

// Deux matchs d'une même page de tournoi ont le même pageid : les liker tous les
// deux doit créer deux abonnements, pas réutiliser le premier.
func TestSubscribeToMatch_TwoMatchesOfTheSamePage(t *testing.T) {
	db, srv, token := subscriptionServer(t)

	for _, m2 := range []string{"G85V6AZKJ9_0001", "G85V6AZKJ9_0002"} {
		rec := subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/matches/381867", subBody(m2))
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), m2)
	}
	// Relike : idempotent.
	rec := subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/matches/381867", subBody("G85V6AZKJ9_0001"))
	require.Equal(t, http.StatusCreated, rec.Code)

	var count int64
	require.NoError(t, db.Model(&models.MatchSubscription{}).Count(&count).Error)
	assert.EqualValues(t, 2, count)

	rec = subRequest(t, srv, token, http.MethodGet, "/api/subscriptions/matches/match2ids", "")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `["G85V6AZKJ9_0001","G85V6AZKJ9_0002"]`, rec.Body.String())
}

func TestUnsubscribeFromMatch_ByMatch2IDKeepsTheOtherMatchOfThePage(t *testing.T) {
	db, srv, token := subscriptionServer(t)
	for _, m2 := range []string{"G85V6AZKJ9_R01-M001", "G85V6AZKJ9_R01-M002"} {
		require.Equal(t, http.StatusCreated, subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/matches/381867", subBody(m2)).Code)
	}

	rec := subRequest(t, srv, token, http.MethodDelete, "/api/subscriptions/matches/G85V6AZKJ9_R01-M001", "")
	require.Equal(t, http.StatusOK, rec.Code)

	var left []models.MatchSubscription
	require.NoError(t, db.Find(&left).Error)
	require.Len(t, left, 1)
	assert.Equal(t, "G85V6AZKJ9_R01-M002", left[0].Match2ID)
}

// L'app publiée ne connaît que le pageid : son cœur s'allume pour toute la page,
// donc le retirer doit vider toute la page.
func TestUnsubscribeFromMatch_NumericIDFromPublishedApp(t *testing.T) {
	db, srv, token := subscriptionServer(t)
	for _, m2 := range []string{"G85V6AZKJ9_0001", "G85V6AZKJ9_0002"} {
		require.Equal(t, http.StatusCreated, subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/matches/381867", subBody(m2)).Code)
	}

	require.Equal(t, http.StatusOK, subRequest(t, srv, token, http.MethodDelete, "/api/subscriptions/matches/381867", "").Code)

	var count int64
	require.NoError(t, db.Model(&models.MatchSubscription{}).Count(&count).Error)
	assert.Zero(t, count)
}

// Les matchs auto-créés (tournoi, équipe favorite) ne consomment pas la limite
// gratuite : sinon suivre un tournoi bloquerait tout like manuel.
func TestSubscribeToMatch_AutoCreatedRowsDoNotCountTowardsFreeLimit(t *testing.T) {
	db, srv, token := subscriptionServer(t)

	var user models.User
	require.NoError(t, db.Where("email = ?", "sub-test@example.com").First(&user).Error)
	tournamentID := int64(99)
	for i := 0; i < FreeMatchSubLimit; i++ {
		require.NoError(t, db.Create(&models.MatchSubscription{
			UserID: user.ID, MatchID: 99, Match2ID: fmt.Sprintf("AUTO_%d", i), Status: "upcoming", FromTournament: &tournamentID,
		}).Error)
	}

	rec := subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/matches/381867", subBody("G85V6AZKJ9_0001"))
	assert.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	for i := 2; i <= FreeMatchSubLimit; i++ {
		require.Equal(t, http.StatusCreated, subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/matches/381867", subBody(fmt.Sprintf("G85V6AZKJ9_000%d", i))).Code)
	}
	rec = subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/matches/381867", subBody("G85V6AZKJ9_0009"))
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func subTestUser(t *testing.T, db *gorm.DB) models.User {
	t.Helper()
	var user models.User
	require.NoError(t, db.Where("email = ?", "sub-test@example.com").First(&user).Error)
	return user
}

// Un match terminé libère sa place : sans ça la limite gratuite était une limite à vie.
func TestSubscribeToMatch_FinishedRowsDoNotCountTowardsFreeLimit(t *testing.T) {
	db, srv, token := subscriptionServer(t)
	user := subTestUser(t, db)
	for i := 0; i < FreeMatchSubLimit; i++ {
		require.NoError(t, db.Create(&models.MatchSubscription{
			UserID: user.ID, MatchID: 99, Match2ID: fmt.Sprintf("DONE_%d", i), Status: "finished",
		}).Error)
	}

	rec := subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/matches/381867", subBody("G85V6AZKJ9_0001"))
	assert.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
}

// L'app publiée applique la limite localement sur ces listes : y laisser les
// matchs terminés la garderait bloquée alors que le backend accepte.
func TestSubscriptionIDs_ExcludeEndedButFullListKeepsThem(t *testing.T) {
	db, srv, token := subscriptionServer(t)
	user := subTestUser(t, db)
	require.NoError(t, db.Create(&models.MatchSubscription{UserID: user.ID, MatchID: 1, Match2ID: "DONE", Status: "finished"}).Error)
	require.NoError(t, db.Create(&models.MatchSubscription{UserID: user.ID, MatchID: 2, Match2ID: "LIVE", Status: "running"}).Error)
	require.NoError(t, db.Create(&models.TournamentSubscription{UserID: user.ID, TournamentID: 1, GameAcronym: "cs2", Status: "finished"}).Error)
	require.NoError(t, db.Create(&models.TournamentSubscription{UserID: user.ID, TournamentID: 2, GameAcronym: "cs2", Status: "running"}).Error)

	get := func(path string) string {
		rec := subRequest(t, srv, token, http.MethodGet, path, "")
		require.Equal(t, http.StatusOK, rec.Code)
		return rec.Body.String()
	}
	assert.JSONEq(t, `[2]`, get("/api/subscriptions/matches/ids"))
	assert.JSONEq(t, `["LIVE"]`, get("/api/subscriptions/matches/match2ids"))
	assert.JSONEq(t, `[2]`, get("/api/subscriptions/tournaments/ids"))
	assert.Contains(t, get("/api/subscriptions/matches"), "DONE", "the profile still lists it, as finished")
}

func TestSubscribeToTournament_FinishedRowsDoNotCountTowardsFreeLimit(t *testing.T) {
	db, srv, token := subscriptionServer(t)
	user := subTestUser(t, db)
	for i := 0; i < FreeTournamentSubLimit; i++ {
		require.NoError(t, db.Create(&models.TournamentSubscription{
			UserID: user.ID, TournamentID: int64(i + 1), GameAcronym: "cs2", Status: "finished",
		}).Error)
	}

	rec := subRequest(t, srv, token, http.MethodPost, "/api/subscriptions/tournaments/500", `{"tournament_name":"T","game_acronym":"cs2"}`)
	assert.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
}

// The app fires this DELETE alongside its logout: arriving second must still
// retire the push token, or the phone keeps getting alerts for that account.
func TestUnregisterPushTokenWorksOnEndedSession(t *testing.T) {
	db, srv, token := subscriptionServer(t)
	require.NoError(t, db.AutoMigrate(&models.PushToken{}))
	claims, err := utils.VerifyJWT(token, subTestSecret)
	require.NoError(t, err)
	push := models.PushToken{UserID: claims.UserID, Token: "ExponentPushToken[unregister-test]", Platform: "ios", Active: true}
	require.NoError(t, db.Where("token = ?", push.Token).Delete(&models.PushToken{}).Error)
	require.NoError(t, db.Create(&push).Error)

	sessionKey := cache.JWTKey(claims.ID)
	require.NoError(t, subTestCache.Del(context.Background(), sessionKey))

	assert.Equal(t, http.StatusUnauthorized, subRequest(t, srv, token, http.MethodGet, "/api/subscriptions/matches/ids", "").Code)
	rec := subRequest(t, srv, token, http.MethodDelete, "/api/push-tokens", `{"token":"`+push.Token+`"}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	require.NoError(t, db.First(&push, push.ID).Error)
	assert.False(t, push.Active)
}
