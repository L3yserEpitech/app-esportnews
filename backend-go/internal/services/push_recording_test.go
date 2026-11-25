package services

import (
	"context"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/models"
)

func pushTestLogger() *logrus.Logger {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return logger
}

func TestNotifyNewContent_RecordsTheBroadcast(t *testing.T) {
	db := subscriptionTestDB(t)
	require.NoError(t, db.Create(&[]models.PushToken{
		{UserID: 1, Token: "ExponentPushToken[local-test-a]", Platform: "ios", Active: true},
		{UserID: 2, Token: "ExponentPushToken[local-test-gone]", Platform: "android", Active: true},
		{UserID: 3, Token: "ExponentPushToken[local-test-c]", Platform: "android", Active: true},
	}).Error)
	// Created active then switched off: the column defaults to true.
	off := models.PushToken{UserID: 4, Token: "ExponentPushToken[local-test-off]", Platform: "ios", Active: true}
	require.NoError(t, db.Create(&off).Error)
	require.NoError(t, db.Model(&off).Update("active", false).Error)

	fake := &fakeExpo{ticketFor: func(token string) ExpoPushTicket {
		if token == "ExponentPushToken[local-test-gone]" {
			return errorTicket(PushErrorDeviceNotRegistered)
		}
		return ExpoPushTicket{Status: "ok"}
	}}
	push := newTestPushService(t, fake)
	rec := &captureRecorder{}
	push.SetRecorder(rec)

	article := &models.Article{
		ID: 4821, Title: cnStr("Karmine Corp recrute"), Slug: cnStr("karmine-corp-recrute"),
		Category: cnStr("Actus"), Description: cnStr("Le club annonce son roster."),
	}
	NewContentNotificationService(db, push, pushTestLogger()).NotifyNewContent(context.Background(), article)

	require.Len(t, fake.sendCalls, 1)
	require.Len(t, fake.sendCalls[0], 3, "inactive devices are left out")
	first := fake.sendCalls[0][0]
	assert.Equal(t, "content-updates", first.ChannelId)
	assert.Equal(t, map[string]interface{}{"type": "new_news", "slug": "karmine-corp-recrute"}, first.Data)

	require.Len(t, rec.records, 1)
	got := rec.records[0]
	assert.Equal(t, PushKindArticle, got.Kind)
	assert.Equal(t, "4821", got.Ref)
	assert.Equal(t, "Karmine Corp recrute", got.Title)
	assert.Equal(t, "Le club annonce son roster.", got.Body)
	assert.Equal(t, "Tous les appareils", got.Audience)
	require.Len(t, got.Results, 3)
	failed := 0
	for _, r := range got.Results {
		if !r.OK() {
			failed++
			assert.Equal(t, "ExponentPushToken[local-test-gone]", r.Token)
		} else {
			assert.NotEmpty(t, r.TicketID)
		}
	}
	assert.Equal(t, 1, failed)

	var gone models.PushToken
	require.NoError(t, db.Where("token = ?", "ExponentPushToken[local-test-gone]").First(&gone).Error)
	assert.False(t, gone.Active)
}

func TestNotifyNewContent_NoDeviceNoEntry(t *testing.T) {
	db := subscriptionTestDB(t)
	fake := &fakeExpo{}
	push := newTestPushService(t, fake)
	rec := &captureRecorder{}
	push.SetRecorder(rec)

	NewContentNotificationService(db, push, pushTestLogger()).NotifyNewContent(context.Background(),
		&models.Article{ID: 7, Title: cnStr("Sans appareil")})

	assert.Empty(t, fake.sendCalls)
	assert.Empty(t, rec.records)
}

func dueMatchSub(userID int64, match2ID, name string, beginAt time.Time) models.MatchSubscription {
	return models.MatchSubscription{
		UserID: userID, MatchID: 381867, Match2ID: match2ID, GameAcronym: "cs2",
		MatchName: name, BeginAt: &beginAt, Status: "upcoming",
	}
}

// One history entry per match, however many subscribers and devices it has.
func TestProcessMatchNotifications_RecordsOneEntryPerMatch(t *testing.T) {
	db := subscriptionTestDB(t)
	svc, _ := newTestService(t, http.NotFoundHandler())

	require.NoError(t, db.Create(&[]models.PushToken{
		{UserID: 1, Token: "ExponentPushToken[local-test-u1-phone]", Platform: "ios", Active: true},
		{UserID: 1, Token: "ExponentPushToken[local-test-u1-tablet]", Platform: "ios", Active: true},
		{UserID: 2, Token: "ExponentPushToken[local-test-u2]", Platform: "android", Active: true},
		{UserID: 3, Token: "ExponentPushToken[local-test-u3]", Platform: "android", Active: true},
	}).Error)
	started := time.Now().UTC().Add(-time.Minute)
	require.NoError(t, db.Create(&[]models.MatchSubscription{
		dueMatchSub(1, "G85V6AZKJ9_0001", "Vitality vs Karmine Corp", started),
		dueMatchSub(2, "G85V6AZKJ9_0001", "Vitality vs Karmine Corp", started),
		dueMatchSub(3, "G85V6AZKJ9_0002", "NAVI vs FaZe", started),
		// No device: nothing to send, nothing to count.
		dueMatchSub(4, "G85V6AZKJ9_0002", "NAVI vs FaZe", started),
	}).Error)

	fake := &fakeExpo{ticketFor: func(token string) ExpoPushTicket {
		if token == "ExponentPushToken[local-test-u2]" {
			return errorTicket(PushErrorDeviceNotRegistered)
		}
		return ExpoPushTicket{Status: "ok"}
	}}
	push := newTestPushService(t, fake)
	rec := &captureRecorder{}
	push.SetRecorder(rec)

	NewNotificationScheduler(db, svc, push, pushTestLogger()).processMatchNotifications(context.Background())

	require.Len(t, fake.sendCalls, 1)
	require.Len(t, fake.sendCalls[0], 4)
	msg := fake.sendCalls[0][0]
	assert.Equal(t, "Match en direct", msg.Title)
	assert.Equal(t, "match-alerts", msg.ChannelId)
	assert.Equal(t, "match_start", msg.Data["type"])
	assert.Equal(t, "counterstrike", msg.Data["wiki"])
	assert.NotEmpty(t, msg.Data["m2"])

	require.Len(t, rec.records, 2)
	byRef := map[string]PushRecord{}
	for _, r := range rec.records {
		byRef[r.Ref] = r
	}
	first := byRef["G85V6AZKJ9_0001"]
	assert.Equal(t, PushKindMatch, first.Kind)
	assert.Equal(t, "Match en direct · Vitality vs Karmine Corp", first.Title)
	assert.Equal(t, "Vitality contre Karmine Corp commence maintenant !", first.Body)
	assert.Equal(t, "Abonnés au match", first.Audience)
	require.Len(t, first.Results, 3)
	assert.Equal(t, []string{"ExponentPushToken[local-test-u2]"}, InvalidTokens(first.Results))

	second := byRef["G85V6AZKJ9_0002"]
	assert.Equal(t, "Match en direct · NAVI vs FaZe", second.Title)
	require.Len(t, second.Results, 1)
	assert.Equal(t, "ExponentPushToken[local-test-u3]", second.Results[0].Token)

	var notified int64
	require.NoError(t, db.Model(&models.MatchSubscription{}).Where("notified_start = ?", true).Count(&notified).Error)
	assert.EqualValues(t, 4, notified)
	var gone models.PushToken
	require.NoError(t, db.Where("token = ?", "ExponentPushToken[local-test-u2]").First(&gone).Error)
	assert.False(t, gone.Active)
}

// While the switch is off a due alert is consumed without a push, so turning
// it back on never sends an alert for a match that already began.
func TestProcessMatchNotifications_SwitchOffConsumesWithoutSending(t *testing.T) {
	db := subscriptionTestDB(t)
	svc, _ := newTestService(t, http.NotFoundHandler())

	require.NoError(t, db.Create(&models.PushToken{UserID: 1, Token: "ExponentPushToken[local-test-u1]", Platform: "ios", Active: true}).Error)
	now := time.Now().UTC()
	due := dueMatchSub(1, "G85V6AZKJ9_0001", "Vitality vs Karmine Corp", now.Add(-time.Minute))
	later := dueMatchSub(1, "G85V6AZKJ9_0002", "NAVI vs FaZe", now.Add(2*time.Hour))
	require.NoError(t, db.Create(&due).Error)
	require.NoError(t, db.Create(&later).Error)

	fake := &fakeExpo{}
	push := newTestPushService(t, fake)
	rec := &captureRecorder{}
	push.SetRecorder(rec)
	enabled := false
	s := NewNotificationScheduler(db, svc, push, pushTestLogger())
	s.SetMatchAlertSwitch(func(context.Context) bool { return enabled })

	s.processMatchNotifications(context.Background())

	assert.Empty(t, fake.sendCalls, "no push while the alert is switched off")
	assert.Empty(t, rec.records)
	var got models.MatchSubscription
	require.NoError(t, db.First(&got, due.ID).Error)
	assert.True(t, got.NotifiedStart, "the due alert is consumed")
	assert.Equal(t, "running", got.Status)
	got = models.MatchSubscription{}
	require.NoError(t, db.First(&got, later.ID).Error)
	assert.False(t, got.NotifiedStart, "a match that has not started keeps its alert")

	enabled = true
	s.processMatchNotifications(context.Background())
	assert.Empty(t, fake.sendCalls, "the match that began while it was off is never alerted")

	// The match still to come is alerted once it starts.
	require.NoError(t, db.Model(&models.MatchSubscription{}).Where("id = ?", later.ID).
		Update("begin_at", time.Now().UTC().Add(-time.Second)).Error)
	s.processMatchNotifications(context.Background())
	require.Len(t, fake.sendCalls, 1)
	require.Len(t, rec.records, 1)
	assert.Equal(t, "G85V6AZKJ9_0002", rec.records[0].Ref)
	assert.Len(t, rec.records[0].Results, 1)
}
