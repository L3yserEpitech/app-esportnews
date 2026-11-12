package testdb

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCheckDSN(t *testing.T) {
	cases := []struct {
		name string
		dsn  string
		ok   bool
	}{
		{"localhost", "postgres://postgres:postgres@localhost:55435/esportnews_test?sslmode=disable", true},
		{"IPv4 locale", "postgres://postgres@127.0.0.1:5432/my_test_db", true},
		{"IPv6 locale", "postgres://postgres@[::1]:5432/esportnews_test", true},
		{"casse du nom", "postgres://postgres@localhost/ESPORT_TEST", true},
		{"Supabase", "postgres://postgres:x@db.abc.supabase.co:5432/postgres", false},
		{"hôte distant, nom de test", "postgres://postgres:x@db.abc.supabase.co:5432/esportnews_test", false},
		{"hôte local, base de prod", "postgres://postgres@localhost:5432/esportnews", false},
		{"hôte remplacé par la query", "postgres://postgres@localhost:5432/esportnews_test?host=db.abc.supabase.co", false},
		{"base remplacée par la query", "postgres://postgres@localhost:5432/esportnews_test?database=postgres", false},
		{"second hôte distant", "postgres://postgres@localhost:5432,db.abc.supabase.co:5432/esportnews_test", false},
		{"forme mots-clés, distante", "host=db.abc.supabase.co dbname=esportnews_test user=postgres", false},
		{"illisible", "postgres://%zz", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := checkDSN(tc.dsn)
			if tc.ok {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

// recorder stops the goroutine like testing.T does, without failing the real test.
type recorder struct {
	testing.TB
	skipped, fatal bool
}

func (r *recorder) Helper() {}
func (r *recorder) Skip(...any) {
	r.skipped = true
	runtime.Goexit()
}
func (r *recorder) Fatalf(string, ...any) {
	r.fatal = true
	runtime.Goexit()
}

func openWith(t *testing.T, dsn string) *recorder {
	t.Helper()
	t.Setenv("TEST_DATABASE_URL", dsn)
	rec := &recorder{}
	done := make(chan struct{})
	go func() {
		defer close(done)
		Open(rec)
	}()
	<-done
	return rec
}

func TestOpenSkipsOnlyWithoutURL(t *testing.T) {
	assert.Equal(t, &recorder{skipped: true}, openWith(t, ""))
}

func TestOpenFailsLoudlyOnAForeignURL(t *testing.T) {
	assert.Equal(t, &recorder{fatal: true}, openWith(t, "postgres://postgres:x@db.abc.supabase.co:5432/postgres"))
	assert.Equal(t, &recorder{fatal: true}, openWith(t, "postgres://postgres@localhost:5432/esportnews"))
}
