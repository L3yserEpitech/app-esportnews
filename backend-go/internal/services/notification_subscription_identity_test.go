package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

// Ces tests ont besoin d'un vrai Postgres (index partiel, ON CONFLICT implicite
// de la contrainte) : sautés sans TEST_DATABASE_URL.
func subscriptionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.PushToken{}, &models.MatchSubscription{}, &models.TournamentSubscription{}))
	require.NoError(t, database.EnsureMatchSubscriptionIdentity(db))
	require.NoError(t, db.Exec(`TRUNCATE match_subscription, tournament_subscription, push_token`).Error)
	return db
}

func liqMatchJSON(pageID int, match2ID, date string, dateExact int, team1, team2 string) string {
	return fmt.Sprintf(`{"pageid":%d,"objectname":"%s","match2id":"%s","date":"%s","dateexact":%d,"match2opponents":[{"name":"%s","type":"team"},{"name":"%s","type":"team"}]}`,
		pageID, match2ID, match2ID, date, dateExact, team1, team2)
}

// Tous les matchs d'une page de tournoi portent le même pageid : l'abonné doit
// quand même avoir une ligne par match, donc une alerte par match.
func TestHydrateTournamentMatches_OneRowPerMatchOfTheSamePage(t *testing.T) {
	db := subscriptionTestDB(t)

	const pageID = 381867
	future := time.Now().UTC().Add(2 * time.Hour).Format("2006-01-02 15:04:05")
	later := time.Now().UTC().Add(5 * time.Hour).Format("2006-01-02 15:04:05")
	past := time.Now().UTC().Add(-time.Hour).Format("2006-01-02 15:04:05")

	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/tournament") {
			fmt.Fprintf(w, `{"result":[{"pageid":%d,"pagename":"Some/Tournament"}]}`, pageID)
			return
		}
		fmt.Fprintf(w, `{"result":[%s]}`, strings.Join([]string{
			liqMatchJSON(pageID, "G85V6AZKJ9_0001", future, 1, "Vitality", "Karmine Corp"),
			liqMatchJSON(pageID, "G85V6AZKJ9_0002", later, 1, "NAVI", "FaZe"),
			// Déjà commencé : l'abonné ne doit pas recevoir un "ça commence" en retard.
			liqMatchJSON(pageID, "G85V6AZKJ9_0003", past, 1, "G2", "Spirit"),
			// Date non confirmée : Liquipedia y met une date provisoire.
			liqMatchJSON(pageID, "G85V6AZKJ9_0004", future, 0, "MOUZ", "Astralis"),
			// Bracket pas encore rempli.
			liqMatchJSON(pageID, "G85V6AZKJ9_0005", future, 1, "TBD", "TBD"),
		}, ","))
	}))

	require.NoError(t, db.Create(&models.TournamentSubscription{
		UserID: 1, TournamentID: pageID, GameAcronym: "cs2", TournamentName: "Some Tournament", Status: "running",
	}).Error)

	logger := logrus.New()
	logger.SetOutput(io.Discard)
	s := NewNotificationScheduler(db, svc, nil, logger)
	ctx := context.Background()

	s.hydrateTournamentMatches(ctx)
	s.hydrateTournamentMatches(ctx) // idempotent

	var subs []models.MatchSubscription
	require.NoError(t, db.Order("match2_id").Find(&subs).Error)
	require.Len(t, subs, 2)
	assert.Equal(t, "G85V6AZKJ9_0001", subs[0].Match2ID)
	assert.Equal(t, "G85V6AZKJ9_0002", subs[1].Match2ID)
	assert.Equal(t, "Vitality vs Karmine Corp", subs[0].MatchName)
	assert.EqualValues(t, pageID, subs[0].MatchID)
	require.NotNil(t, subs[0].FromTournament)
}

// Le cache "running" couvre jusqu'à now+6h et partage son pageid entre matchs :
// seul le match réellement commencé doit basculer.
func TestProcessMatchNotifications_OnlyTheStartedMatchOfThePage(t *testing.T) {
	db := subscriptionTestDB(t)

	const pageID = 381867
	now := time.Now().UTC()
	started := now.Add(-2 * time.Minute)
	soon := now.Add(3 * time.Hour)

	svc, mr := newTestService(t, http.NotFoundHandler())
	mr.Set(cache.LiqMatchesRunningKey("counterstrike"), fmt.Sprintf(`{"result":[%s,%s]}`,
		liqMatchJSON(pageID, "G85V6AZKJ9_0001", started.Format("2006-01-02 15:04:05"), 1, "Vitality", "Karmine Corp"),
		liqMatchJSON(pageID, "G85V6AZKJ9_0002", soon.Format("2006-01-02 15:04:05"), 1, "NAVI", "FaZe"),
	))

	// Annoncé plus tard que son heure réelle : seul le filet "running" le rattrape.
	announced := now.Add(time.Hour)
	movedEarlier := models.MatchSubscription{UserID: 1, MatchID: pageID, Match2ID: "G85V6AZKJ9_0001", GameAcronym: "cs2", BeginAt: &announced, Status: "upcoming"}
	// Reporté : même page, pas commencé, l'heure doit être mise à jour sans envoi.
	stale := now.Add(time.Hour)
	notStarted := models.MatchSubscription{UserID: 1, MatchID: pageID, Match2ID: "G85V6AZKJ9_0002", GameAcronym: "cs2", BeginAt: &stale, Status: "upcoming"}
	require.NoError(t, db.Create(&movedEarlier).Error)
	require.NoError(t, db.Create(&notStarted).Error)

	logger := logrus.New()
	logger.SetOutput(io.Discard)
	s := NewNotificationScheduler(db, svc, nil, logger)
	s.processMatchNotifications(context.Background())

	var got models.MatchSubscription
	require.NoError(t, db.First(&got, movedEarlier.ID).Error)
	assert.True(t, got.NotifiedStart, "the started match must be flagged")

	got = models.MatchSubscription{}
	require.NoError(t, db.First(&got, notStarted.ID).Error)
	assert.False(t, got.NotifiedStart, "a match of the same page that has not started must not be flagged")
	assert.WithinDuration(t, soon, *got.BeginAt, time.Second, "the reschedule must still be persisted")
}

// Les lignes dues doivent passer devant celles à venir, sinon une accumulation
// d'abonnements futurs repousserait indéfiniment des alertes.
func TestProcessMatchNotifications_DueRowsBeatFutureOnesAtTheTickLimit(t *testing.T) {
	db := subscriptionTestDB(t)
	svc, _ := newTestService(t, http.NotFoundHandler())

	future := time.Now().UTC().Add(48 * time.Hour)
	rows := make([]models.MatchSubscription, 0, maxSubsPerTick)
	for i := 0; i < maxSubsPerTick; i++ {
		rows = append(rows, models.MatchSubscription{UserID: 1, MatchID: 1, Match2ID: fmt.Sprintf("FUTURE_%d", i), GameAcronym: "cs2", BeginAt: &future, Status: "upcoming"})
	}
	require.NoError(t, db.CreateInBatches(rows, 200).Error)
	due := time.Now().UTC().Add(-time.Minute)
	dueRow := models.MatchSubscription{UserID: 1, MatchID: 1, Match2ID: "DUE", GameAcronym: "cs2", BeginAt: &due, Status: "upcoming"}
	require.NoError(t, db.Create(&dueRow).Error)

	logger := logrus.New()
	logger.SetOutput(io.Discard)
	NewNotificationScheduler(db, svc, nil, logger).processMatchNotifications(context.Background())

	var got models.MatchSubscription
	require.NoError(t, db.First(&got, dueRow.ID).Error)
	assert.True(t, got.NotifiedStart)
}

func newLifecycleScheduler(db *gorm.DB, svc *LiquipediaService) *NotificationScheduler {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return NewNotificationScheduler(db, svc, nil, logger)
}

func subStatus(t *testing.T, db *gorm.DB, id int64) string {
	t.Helper()
	var got models.MatchSubscription
	require.NoError(t, db.First(&got, id).Error)
	return got.Status
}

// Personne ne passait jamais un abonnement en "finished" : la purge ne supprimait
// rien, le profil affichait "En direct" à vie et la limite gratuite se remplissait
// pour de bon.
func TestFinishEndedSubscriptions_Matches(t *testing.T) {
	db := subscriptionTestDB(t)
	now := time.Now().UTC()
	at := func(d time.Duration) *time.Time { v := now.Add(d); return &v }

	svc, mr := newTestService(t, http.NotFoundHandler())
	mr.Set(cache.LiqMatchesPastKey("counterstrike"), fmt.Sprintf(`{"result":[%s]}`,
		liqMatchJSON(1, "IN_PAST_CACHE", now.Add(-time.Hour).Format("2006-01-02 15:04:05"), 1, "A", "B")))

	row := func(m2 string, begin *time.Time, status string) int64 {
		sub := models.MatchSubscription{UserID: 1, MatchID: 1, Match2ID: m2, GameAcronym: "cs2", BeginAt: begin, Status: status, NotifiedStart: true}
		require.NoError(t, db.Create(&sub).Error)
		return sub.ID
	}
	inPast := row("IN_PAST_CACHE", at(-time.Hour), "running")
	live := row("STILL_LIVE", at(-time.Hour), "running")
	abandoned := row("NEVER_CLOSED", at(-25*time.Hour), "running")
	upcoming := row("UPCOMING", at(time.Hour), "upcoming")

	newLifecycleScheduler(db, svc).finishEndedSubscriptions(context.Background())

	assert.Equal(t, "finished", subStatus(t, db, inPast), "found in the past cache")
	assert.Equal(t, "running", subStatus(t, db, live), "still playing")
	assert.Equal(t, "finished", subStatus(t, db, abandoned), "the running cache only reaches 24 h back")
	assert.Equal(t, "upcoming", subStatus(t, db, upcoming))
}

// La purge suit la date du match : un like posé longtemps à l'avance ne doit pas
// disparaître le jour où le match se termine, ni un vieux match rester à vie.
func TestCleanupStaleSubscriptions_UsesTheMatchDate(t *testing.T) {
	db := subscriptionTestDB(t)
	svc, _ := newTestService(t, http.NotFoundHandler())
	now := time.Now().UTC()
	old := now.Add(-8 * 24 * time.Hour)
	recent := now.Add(-2 * 24 * time.Hour)

	oldMatch := models.MatchSubscription{UserID: 1, MatchID: 1, Match2ID: "OLD", BeginAt: &old, Status: "finished"}
	recentMatch := models.MatchSubscription{UserID: 1, MatchID: 1, Match2ID: "RECENT", BeginAt: &recent, Status: "finished", CreatedAt: now.Add(-30 * 24 * time.Hour)}
	require.NoError(t, db.Create(&oldMatch).Error)
	require.NoError(t, db.Create(&recentMatch).Error)
	noEnd := models.TournamentSubscription{UserID: 1, TournamentID: 1, Status: "finished", BeginAt: &old}
	require.NoError(t, db.Create(&noEnd).Error)

	newLifecycleScheduler(db, svc).cleanupStaleSubscriptions(context.Background())

	var left []string
	require.NoError(t, db.Model(&models.MatchSubscription{}).Pluck("match2_id", &left).Error)
	assert.Equal(t, []string{"RECENT"}, left)
	var tournaments int64
	require.NoError(t, db.Model(&models.TournamentSubscription{}).Count(&tournaments).Error)
	assert.Zero(t, tournaments, "a tournament without end_at must be purged too")
}

// Un tournoi n'est clos que s'il ne reste rien à jouer : sa date de fin vient de
// l'app au moment de l'abonnement et peut avoir été repoussée depuis.
func TestHydrateTournamentMatches_ClosesOnlyAnEndedTournamentWithNothingLeft(t *testing.T) {
	db := subscriptionTestDB(t)
	now := time.Now().UTC()
	longAgo := now.Add(-5 * 24 * time.Hour)
	soon := now.Add(5 * 24 * time.Hour)
	future := now.Add(2 * time.Hour).Format("2006-01-02 15:04:05")
	past := now.Add(-6 * 24 * time.Hour).Format("2006-01-02 15:04:05")

	svc, _ := newTestService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cond := r.URL.Query().Get("conditions")
		switch {
		case strings.HasSuffix(r.URL.Path, "/tournament"):
			id := strings.TrimSuffix(strings.TrimPrefix(cond, "[[pageid::"), "]]")
			fmt.Fprintf(w, `{"result":[{"pageid":%s,"pagename":"T_%s"}]}`, id, id)
		case strings.Contains(cond, "T_10"): // finie, plus rien à jouer
			fmt.Fprintf(w, `{"result":[%s]}`, liqMatchJSON(10, "M10", past, 1, "A", "B"))
		case strings.Contains(cond, "T_20"): // date dépassée mais prolongé
			fmt.Fprintf(w, `{"result":[%s]}`, liqMatchJSON(20, "M20", future, 1, "A", "B"))
		case strings.Contains(cond, "T_40"): // Liquipedia indisponible
			w.WriteHeader(http.StatusInternalServerError)
		default:
			fmt.Fprintf(w, `{"result":[%s]}`, liqMatchJSON(30, "M30", past, 1, "A", "B"))
		}
	}))

	row := func(id int64, end *time.Time) int64 {
		sub := models.TournamentSubscription{UserID: 1, TournamentID: id, GameAcronym: "cs2", EndAt: end, Status: "running"}
		require.NoError(t, db.Create(&sub).Error)
		return sub.ID
	}
	ended := row(10, &longAgo)
	extended := row(20, &longAgo)
	notOver := row(30, &soon)
	unreachable := row(40, &longAgo)
	// Second abonné au tournoi en échec : il hérite du résultat mémorisé du premier.
	unreachable2 := models.TournamentSubscription{UserID: 2, TournamentID: 40, GameAcronym: "cs2", EndAt: &longAgo, Status: "running"}
	require.NoError(t, db.Create(&unreachable2).Error)

	newLifecycleScheduler(db, svc).hydrateTournamentMatches(context.Background())

	status := func(id int64) string {
		var got models.TournamentSubscription
		require.NoError(t, db.First(&got, id).Error)
		return got.Status
	}
	assert.Equal(t, "finished", status(ended))
	assert.Equal(t, "running", status(extended), "a match is still to come")
	assert.Equal(t, "running", status(notOver))
	assert.Equal(t, "running", status(unreachable), "a failed fetch says nothing about the tournament")
	assert.Equal(t, "running", status(unreachable2.ID))
}

// Filet pour ce que l'hydratation ne peut pas clore : jeux hérités de PandaScore
// (aucun wiki) ou tournois sans date de fin.
func TestFinishEndedSubscriptions_TournamentHardCap(t *testing.T) {
	db := subscriptionTestDB(t)
	svc, _ := newTestService(t, http.NotFoundHandler())
	now := time.Now().UTC()
	at := func(d time.Duration) *time.Time { v := now.Add(d); return &v }
	day := 24 * time.Hour

	row := func(id int64, begin, end *time.Time) int64 {
		sub := models.TournamentSubscription{UserID: 1, TournamentID: id, GameAcronym: "dota-2", BeginAt: begin, EndAt: end, Status: "running"}
		require.NoError(t, db.Create(&sub).Error)
		return sub.ID
	}
	longPastEnd := row(1, nil, at(-31*day))
	recentEnd := row(2, nil, at(-10*day))
	noEndOld := row(3, at(-91*day), nil)
	noEndRecent := row(4, at(-20*day), nil)

	newLifecycleScheduler(db, svc).finishEndedSubscriptions(context.Background())

	status := func(id int64) string {
		var got models.TournamentSubscription
		require.NoError(t, db.First(&got, id).Error)
		return got.Status
	}
	assert.Equal(t, "finished", status(longPastEnd))
	assert.Equal(t, "running", status(recentEnd))
	assert.Equal(t, "finished", status(noEndOld))
	assert.Equal(t, "running", status(noEndRecent))
}
