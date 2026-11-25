package backoffice

import (
	"context"
	"fmt"
	"io"
	"sync"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/testdb"
)

const articleTestPrefix = "boarticletest "

// articleTestModule only removes the rows it made: other tests of the package
// share the database.
func articleTestModule(t *testing.T) *Module {
	t.Helper()
	db := testdb.Open(t)
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Game{}, &models.Article{}))
	require.NoError(t, EnsureSchema(db))

	clean := func() {
		like := articleTestPrefix + "%"
		require.NoError(t, db.Exec(`DELETE FROM bo_article_version WHERE article_id IN (SELECT id FROM articles WHERE title LIKE ?)`, like).Error)
		require.NoError(t, db.Exec(`DELETE FROM bo_audit_log WHERE target_label LIKE ?`, like).Error)
		require.NoError(t, db.Exec(`DELETE FROM articles WHERE title LIKE ?`, like).Error)
	}
	clean()
	t.Cleanup(clean)

	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return &Module{db: db, log: logger, articles: services.NewArticleServiceWithGORM(&database.Database{DB: db}, nil)}
}

var articleTestAuthor = &teamUser{ID: 4242, Name: "Rédactrice de test", Role: RoleEditor}

func (m *Module) testSave(t *testing.T, cur *models.Article, in articleInput) *models.Article {
	t.Helper()
	ctx := context.Background()
	w, err := m.planSave(ctx, articleTestAuthor, cur, &in)
	require.NoError(t, err)
	res, err := m.writeArticle(ctx, w)
	require.NoError(t, err)
	return res.article
}

func publicSlugs(t *testing.T, m *Module) []string {
	t.Helper()
	rows, err := m.articles.GetArticles(context.Background(), 100, 0, services.ArticleFilter{})
	require.NoError(t, err)
	out := []string{}
	for _, a := range rows {
		out = append(out, deref(a.Slug))
	}
	return out
}

func TestArticleLifecycleFollowsTheRulesOfTheSite(t *testing.T) {
	m := articleTestModule(t)
	title := articleTestPrefix + "cycle de vie"

	draft := m.testSave(t, nil, articleInput{Title: &title, ArticleContent: artPtr("<p>Texte</p>"), Category: artPtr("Actus")})
	require.Equal(t, statusDraft, draft.Status)
	assert.Equal(t, "boarticletest-cycle-de-vie", deref(draft.Slug))
	assert.Equal(t, articleTestAuthor.Name, deref(draft.Author))
	require.NotNil(t, draft.AuthorID)
	assert.Equal(t, articleTestAuthor.ID, *draft.AuthorID)
	assert.NotContains(t, publicSlugs(t, m), deref(draft.Slug), "a draft never reaches the site")

	// The address follows the title until the first publication.
	renamed := m.testSave(t, draft, articleInput{Title: artPtr(title + " renommé")})
	assert.Equal(t, "boarticletest-cycle-de-vie-renomme", deref(renamed.Slug))

	// created_at is the publication date everywhere on the site: it restarts.
	require.NoError(t, m.db.Exec(`UPDATE articles SET created_at = now() - interval '3 days', updated_at = now() - interval '3 days' WHERE id = ?`, draft.ID).Error)
	stale, err := m.articleByIDForTest(draft.ID)
	require.NoError(t, err)
	published := m.testSave(t, stale, articleInput{Status: artPtr(statusPublished)})
	require.Equal(t, statusPublished, published.Status)
	assert.WithinDuration(t, time.Now(), published.CreatedAt, 5*time.Second)
	assert.Contains(t, publicSlugs(t, m), deref(published.Slug))
	// What everPublished reads once the status no longer says so.
	m.writeAudit(auditEntry{Action: "article.published", TargetType: "article", TargetID: articleRef(published), TargetLabel: deref(published.Title)})

	// A published article keeps its address and its date; filing it is not an edit.
	require.NoError(t, m.db.Exec(`UPDATE articles SET created_at = now() - interval '2 days', updated_at = now() - interval '2 days' WHERE id = ?`, draft.ID).Error)
	published, err = m.articleByIDForTest(draft.ID)
	require.NoError(t, err)
	filed := m.testSave(t, published, articleInput{Category: artPtr("Analyse"), NotifyOnPublish: artPtr(false)})
	assert.True(t, filed.UpdatedAt.Equal(published.UpdatedAt), "category and push toggle leave updated_at alone")
	retitled := m.testSave(t, filed, articleInput{Title: artPtr(title + " corrigé")})
	assert.Equal(t, deref(published.Slug), deref(retitled.Slug), "the slug of a published article is frozen")
	assert.True(t, retitled.CreatedAt.Equal(published.CreatedAt), "created_at of a published article never moves")
	assert.WithinDuration(t, time.Now(), retitled.UpdatedAt, 5*time.Second, "a new title is an edit")

	// Unpublished, then renamed: the address was public, it stays.
	unpublished := m.testSave(t, retitled, articleInput{Status: artPtr(statusDraft)})
	require.Equal(t, statusDraft, unpublished.Status)
	assert.NotContains(t, publicSlugs(t, m), deref(unpublished.Slug))
	again := m.testSave(t, unpublished, articleInput{Title: artPtr(title + " encore")})
	assert.Equal(t, deref(published.Slug), deref(again.Slug))
}

func (m *Module) articleByIDForTest(id int64) (*models.Article, error) {
	var a models.Article
	err := m.db.First(&a, id).Error
	return &a, err
}

// An article written before the back-office keeps the body columns its tool
// produced as long as the body itself is not edited.
func TestSavingWithoutTouchingTheBodyLeavesItsColumnsAlone(t *testing.T) {
	m := articleTestModule(t)
	title, slug := articleTestPrefix+"ancien", "bo-article-test-ancien"
	legacy := models.Article{
		Title: &title, Slug: &slug, Author: artPtr("Quelqu'un"), Category: artPtr("Actus"),
		Content: artPtr("<p><br>Ancien corps</p>"), ContentBlack: artPtr("<div>noir maison</div>"), ContentWhite: artPtr("<div>blanc maison</div>"),
	}
	require.NoError(t, m.db.Create(&legacy).Error)
	require.Equal(t, statusPublished, legacy.Status)

	admin := &teamUser{ID: 1, Name: "Admin de test", Role: RoleAdmin}
	w, err := m.planSave(context.Background(), admin, &legacy, &articleInput{SeoTitle: artPtr("Titre SEO"), ArticleContent: artPtr("<p><br>Ancien corps</p>")})
	require.NoError(t, err)
	res, err := m.writeArticle(context.Background(), w)
	require.NoError(t, err)

	assert.Equal(t, "Titre SEO", deref(res.article.SeoTitle))
	assert.Nil(t, res.article.ArticleContent, "article_content stays NULL")
	assert.Equal(t, "<div>noir maison</div>", deref(res.article.ContentBlack))
	assert.Equal(t, "<div>blanc maison</div>", deref(res.article.ContentWhite))
	assert.Equal(t, "Quelqu'un", deref(res.article.Author), "the byline of someone outside the team is kept")
	assert.Nil(t, res.article.AuthorID)

	edited := m.testSaveAs(t, admin, res.article, articleInput{ArticleContent: artPtr("<p>Nouveau corps</p>")})
	assert.Equal(t, "<p>Nouveau corps</p>", deref(edited.ArticleContent))
	assert.Equal(t, "<p>Nouveau corps</p>", deref(edited.Content))
	assert.Contains(t, deref(edited.ContentBlack), "color: #000000")
	assert.Contains(t, deref(edited.ContentWhite), "color: #ffffff")
}

func (m *Module) testSaveAs(t *testing.T, who *teamUser, cur *models.Article, in articleInput) *models.Article {
	t.Helper()
	w, err := m.planSave(context.Background(), who, cur, &in)
	require.NoError(t, err)
	res, err := m.writeArticle(context.Background(), w)
	require.NoError(t, err)
	return res.article
}

func TestVersionsAreCappedAndAutosavesShareOne(t *testing.T) {
	m := articleTestModule(t)
	title := articleTestPrefix + "versions"
	a := m.testSave(t, nil, articleInput{Title: &title})

	count := func() (n int64) {
		require.NoError(t, m.db.Raw(`SELECT count(*) FROM bo_article_version WHERE article_id = ?`, a.ID).Scan(&n).Error)
		return n
	}
	require.EqualValues(t, 1, count())

	for i := 0; i < 5; i++ {
		a = m.testSave(t, a, articleInput{Subtitle: artPtr(fmt.Sprintf("chapô %d", i)), Autosave: true})
	}
	assert.EqualValues(t, 2, count(), "a run of autosaves is one version")
	var label string
	require.NoError(t, m.db.Raw(`SELECT label FROM bo_article_version WHERE article_id = ? ORDER BY id DESC LIMIT 1`, a.ID).Scan(&label).Error)
	assert.Equal(t, "chapô", label)

	for i := 0; i < maxVersions+5; i++ {
		a = m.testSave(t, a, articleInput{Description: artPtr(fmt.Sprintf("description %d", i))})
	}
	assert.EqualValues(t, maxVersions, count())
}

// Two instances of the backend ticking at the same second: each due article is
// published, logged and versioned once.
func TestScheduledArticlesArePublishedOnce(t *testing.T) {
	first := articleTestModule(t)
	second := &Module{db: first.db, log: first.log, articles: first.articles}

	due := []int64{}
	for i := 0; i < 4; i++ {
		title, slug := fmt.Sprintf("%sdû %d", articleTestPrefix, i), fmt.Sprintf("bo-article-test-du-%d", i)
		a := models.Article{Title: &title, Slug: &slug, Status: statusScheduled, ScheduledAt: artPtr(time.Now().Add(-time.Minute)), CreatedAt: time.Now().Add(-48 * time.Hour)}
		require.NoError(t, first.db.Create(&a).Error)
		// GORM would turn a false into the column default.
		require.NoError(t, first.db.Exec(`UPDATE articles SET notify_on_publish = false WHERE id = ?`, a.ID).Error)
		due = append(due, a.ID)
	}
	laterTitle, laterSlug := articleTestPrefix+"plus tard", "bo-article-test-plus-tard"
	later := models.Article{Title: &laterTitle, Slug: &laterSlug, Status: statusScheduled, ScheduledAt: artPtr(time.Now().Add(time.Hour))}
	require.NoError(t, first.db.Create(&later).Error)
	draftTitle, draftSlug := articleTestPrefix+"brouillon", "bo-article-test-brouillon"
	draft := models.Article{Title: &draftTitle, Slug: &draftSlug, Status: statusDraft}
	require.NoError(t, first.db.Create(&draft).Error)

	var wg sync.WaitGroup
	for _, m := range []*Module{first, second, first, second} {
		wg.Add(1)
		go func(m *Module) {
			defer wg.Done()
			m.publishDue(context.Background())
		}(m)
	}
	wg.Wait()

	for _, id := range due {
		a, err := first.articleByIDForTest(id)
		require.NoError(t, err)
		assert.Equal(t, statusPublished, a.Status)
		assert.Nil(t, a.ScheduledAt)
		assert.WithinDuration(t, time.Now(), a.CreatedAt, 10*time.Second, "published now, not when it was written")

		var audits, versions int64
		require.NoError(t, first.db.Raw(`SELECT count(*) FROM bo_audit_log WHERE action = 'article.published' AND target_id = ? AND actor_name = 'Système'`, articleRef(a)).Scan(&audits).Error)
		require.NoError(t, first.db.Raw(`SELECT count(*) FROM bo_article_version WHERE article_id = ?`, id).Scan(&versions).Error)
		assert.EqualValues(t, 1, audits, "one audit line")
		assert.EqualValues(t, 1, versions, "one version")
	}
	for _, untouched := range []*models.Article{&later, &draft} {
		a, err := first.articleByIDForTest(untouched.ID)
		require.NoError(t, err)
		assert.Equal(t, untouched.Status, a.Status, deref(a.Title))
	}
}

// A save computed from a state the scheduler has since changed is refused
// rather than applied on top of it.
func TestSaveOverAStatusThatMovedIsRefused(t *testing.T) {
	m := articleTestModule(t)
	title := articleTestPrefix + "course"
	a := m.testSave(t, nil, articleInput{Title: &title, ArticleContent: artPtr("<p>Texte</p>"), Category: artPtr("Actus"),
		Status: artPtr(statusScheduled), ScheduledAt: artPtr(time.Now().Add(time.Hour))})

	w, err := m.planSave(context.Background(), articleTestAuthor, a, &articleInput{Subtitle: artPtr("vu trop tard")})
	require.NoError(t, err)
	require.NoError(t, m.db.Exec(`UPDATE articles SET status = 'published', scheduled_at = NULL WHERE id = ?`, a.ID).Error)

	_, err = m.writeArticle(context.Background(), w)
	var fault *faultError
	require.ErrorAs(t, err, &fault)
	assert.Equal(t, 409, fault.status)

	now, err := m.articleByIDForTest(a.ID)
	require.NoError(t, err)
	assert.Equal(t, statusPublished, now.Status)
	assert.Empty(t, deref(now.Subtitle))
}
