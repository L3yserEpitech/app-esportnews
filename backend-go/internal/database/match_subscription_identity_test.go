package database

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/esportnews/backend/internal/models"
)

// Reproduit une base de prod d'avant le correctif : index (user_id, match_id),
// un doublon de match2id (la page d'un match déplacé change de pageid) et des
// lignes héritées sans match2id.
func TestEnsureMatchSubscriptionIdentity(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.MatchSubscription{}))

	require.NoError(t, db.Exec(`TRUNCATE match_subscription`).Error)
	require.NoError(t, db.Exec(`DROP INDEX IF EXISTS idx_user_match2`).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO match_subscription (user_id, match_id, match2_id, notified_start) VALUES
		(1, 10, 'M2_A', false),
		(1, 20, 'M2_A', true),
		(1, 30, 'M2_B', false),
		(1, 40, '',     false),
		(1, 50, NULL,   false),
		(2, 10, 'M2_A', false)`).Error)
	require.NoError(t, db.Exec(`CREATE UNIQUE INDEX idx_user_match ON match_subscription (user_id, match_id)`).Error)

	require.NoError(t, EnsureMatchSubscriptionIdentity(db))
	require.NoError(t, EnsureMatchSubscriptionIdentity(db), "must be idempotent")

	// Le doublon garde la ligne déjà notifiée : sinon l'utilisateur recevrait une
	// seconde alerte pour le même match.
	var kept []int64
	require.NoError(t, db.Raw(`SELECT match_id FROM match_subscription WHERE user_id = 1 AND match2_id = 'M2_A'`).Scan(&kept).Error)
	assert.Equal(t, []int64{20}, kept)

	var legacy int64
	require.NoError(t, db.Raw(`SELECT count(*) FROM match_subscription WHERE COALESCE(match2_id, '') = ''`).Scan(&legacy).Error)
	assert.EqualValues(t, 2, legacy, "legacy rows have no match2id and are not duplicates of anything")

	var oldIndex int64
	require.NoError(t, db.Raw(`SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_user_match'`).Scan(&oldIndex).Error)
	assert.Zero(t, oldIndex)

	// Même page pour deux matchs : autorisé. Même match deux fois : refusé.
	require.NoError(t, db.Exec(`INSERT INTO match_subscription (user_id, match_id, match2_id) VALUES (1, 30, 'M2_C')`).Error)
	assert.Error(t, db.Exec(`INSERT INTO match_subscription (user_id, match_id, match2_id) VALUES (1, 99, 'M2_C')`).Error)
}
