package handlers

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type countingTransport struct {
	calls  atomic.Int32
	status int
}

func (s *countingTransport) RoundTrip(*http.Request) (*http.Response, error) {
	s.calls.Add(1)
	return &http.Response{
		StatusCode: s.status,
		Header:     http.Header{"Content-Type": {"image/png"}},
		Body:       io.NopCloser(strings.NewReader("png")),
	}, nil
}

func newStubbedProxy(status int) (*ImageProxyHandler, *countingTransport) {
	h := NewImageProxyHandler(nil, nil)
	stub := &countingTransport{status: status}
	h.httpClient.Transport = stub
	return h, stub
}

func TestValidateImageURL(t *testing.T) {
	cases := []struct {
		name   string
		url    string
		wantOK bool
	}{
		{"commons thumb", "https://liquipedia.net/commons/images/thumb/a/ab/Logo.png/48px-Logo.png", true},
		{"commons original", "https://liquipedia.net/commons/images/a/ab/Logo.png", true},
		{"commons with wiki hint", "https://liquipedia.net/commons/images/a/ab/Logo.png?w=valorant", true},
		{"www host commons", "https://www.liquipedia.net/commons/images/a/ab/Logo.png", true},
		// The ban trigger: wiki PAGE URLs must be rejected (never fetched).
		{"wiki page", "https://liquipedia.net/leagueoflegends/Hextech_Series_Division_2", false},
		{"wiki page root", "https://liquipedia.net/valorant/VCT", false},
		{"special filepath rejected", "https://liquipedia.net/commons/Special:FilePath/Foo.png", false}, // PHP redirect, not static media
		{"disallowed host", "https://example.com/commons/images/x.png", false},
		{"not https", "http://liquipedia.net/commons/images/x.png", false},
		{"no path", "https://liquipedia.net", false},
		// Each of these reaches Liquipedia under a key of its own: the exact
		// pattern that gets the egress IP banned, on demand and for free.
		{"cache buster", "https://liquipedia.net/commons/images/a/ab/Logo.png?cachebuster=1", false},
		{"hint plus cache buster", "https://liquipedia.net/commons/images/a/ab/Logo.png?w=valorant&x=1", false},
		{"unknown wiki hint", "https://liquipedia.net/commons/images/a/ab/Logo.png?w=aaaa", false},
		{"fragment", "https://liquipedia.net/commons/images/a/ab/Logo.png#x", false},
		{"dot segments to Special", "https://liquipedia.net/commons/images/../Special:FilePath/x.png", false},
		{"dot segments to a wiki page", "https://liquipedia.net/commons/images/../../counterstrike/Main_Page", false},
		{"encoded dot segments", "https://liquipedia.net/commons/images/%2e%2e/%2E%2E/counterstrike/Main_Page", false},
		{"encoded slash", "https://liquipedia.net/commons/images/..%2F..%2Fcounterstrike/Main_Page", false},
		{"backslash", "https://liquipedia.net/commons/images/..\\..\\x.png", false},
		{"lone dot segment", "https://liquipedia.net/commons/images/./a.png", false},
		// Same file under another spelling: another key, another fetch.
		{"escaped letter", "https://liquipedia.net/commons/images/a/ab/%4Cogo.png", false},
		{"escaped dot", "https://liquipedia.net/commons/images/a/ab/Logo%2Epng", false},
		{"lowercase escape", "https://liquipedia.net/commons/images/a/ab/Team_%c3%a9.png", false},
		{"uppercase host", "https://LIQUIPEDIA.net/commons/images/a/ab/Logo.png", false},
		{"every game wiki hint", "https://liquipedia.net/commons/images/a/ab/Logo.png?w=counterstrike", true},
		{"encoded file name", "https://liquipedia.net/commons/images/a/ab/Team_%28old%29_%C3%A9.png", true},
		{"dots inside a file name", "https://liquipedia.net/commons/images/a/ab/T1..lightmode.png", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			key, ok := validateImageURL(c.url)
			if ok != c.wantOK {
				t.Fatalf("validateImageURL(%q) ok=%v, want %v", c.url, ok, c.wantOK)
			}
			if ok && key == "" {
				t.Fatalf("validateImageURL(%q) returned ok but empty cache key", c.url)
			}
		})
	}
}

// A file Liquipedia doesn't have is asked for once, not once per page view.
func TestMissingImageIsNotRefetched(t *testing.T) {
	h, stub := newStubbedProxy(http.StatusNotFound)
	const raw = "https://liquipedia.net/commons/images/a/ab/Missing.png"
	key, ok := validateImageURL(raw)
	if !ok {
		t.Fatal("url refused")
	}
	if _, err := h.fetchAndStore(t.Context(), raw, key); err == nil {
		t.Fatal("expected an error on 404")
	}
	if _, err := h.fetchAndStore(t.Context(), raw, key); err == nil {
		t.Fatal("expected an error on the remembered 404")
	}
	if got := stub.calls.Load(); got != 1 {
		t.Fatalf("upstream called %d times, want 1", got)
	}
}

func TestImageFetchSucceedsAndIsCached(t *testing.T) {
	h, stub := newStubbedProxy(http.StatusOK)
	const raw = "https://liquipedia.net/commons/images/a/ab/Logo.png"
	key, _ := validateImageURL(raw)
	img, err := h.fetchAndStore(t.Context(), raw, key)
	if err != nil || string(img.data) != "png" {
		t.Fatalf("fetch: %v %v", img, err)
	}
	if h.l1Get(key) == nil {
		t.Fatal("not in L1")
	}
	if got := stub.calls.Load(); got != 1 {
		t.Fatalf("upstream called %d times, want 1", got)
	}
}

// A flood of unknown names has no key to dedupe on: past a volume of misses no
// legitimate page produces, upstream is left alone for a while.
func TestUpstreamPausesAfterAFloodOfMisses(t *testing.T) {
	h, _ := newStubbedProxy(http.StatusNotFound)
	for i := 0; i < upstreamMissLimit-1; i++ {
		h.noteUpstreamMiss()
	}
	if h.throttledUntil.Load() != 0 {
		t.Fatal("paused too early")
	}
	h.noteUpstreamMiss()
	if h.throttledUntil.Load() <= time.Now().Unix() {
		t.Fatal("not paused after the limit")
	}
}

func TestUpstreamMissCounterRestartsEachWindow(t *testing.T) {
	h, _ := newStubbedProxy(http.StatusNotFound)
	for i := 0; i < upstreamMissLimit-1; i++ {
		h.noteUpstreamMiss()
	}
	h.missWindowStart.Store(time.Now().Add(-2 * upstreamMissWindow).Unix())
	h.noteUpstreamMiss()
	if h.throttledUntil.Load() != 0 {
		t.Fatal("misses from an old window counted")
	}
}

func TestMemoryCacheStaysWithinItsBudget(t *testing.T) {
	h, _ := newStubbedProxy(http.StatusOK)
	chunk := make([]byte, memoryCacheMaxBytes/10)
	for i := 0; i < 50; i++ {
		h.l1Store(fmt.Sprintf("key-%d", i), &cachedImage{contentType: "image/png", data: chunk, cachedAt: time.Now()})
	}
	if got := h.l1Bytes.Load(); got > memoryCacheMaxBytes {
		t.Fatalf("L1 holds %d bytes, budget %d", got, memoryCacheMaxBytes)
	}
	if h.l1Get("key-49") == nil {
		t.Fatal("the entry just stored was evicted")
	}
	var total int64
	h.cache.Range(func(_, v any) bool {
		total += int64(len(v.(*cachedImage).data))
		return true
	})
	if total != h.l1Bytes.Load() {
		t.Fatalf("counter says %d bytes, cache holds %d", h.l1Bytes.Load(), total)
	}
}

func TestReplacingAnEntryDoesNotInflateTheBudget(t *testing.T) {
	h, _ := newStubbedProxy(http.StatusOK)
	img := &cachedImage{contentType: "image/png", data: make([]byte, 100), cachedAt: time.Now()}
	h.l1Store("same", img)
	h.l1Store("same", img)
	if got := h.l1Bytes.Load(); got != 100 {
		t.Fatalf("counter %d, want 100", got)
	}
}

func TestPrewarmBatchIsDedupedAndCapped(t *testing.T) {
	var urls []string
	for i := 0; i < prewarmMaxURLs+50; i++ {
		urls = append(urls, fmt.Sprintf("https://liquipedia.net/commons/images/a/ab/L%d.png", i))
	}
	urls = append([]string{urls[0], "https://liquipedia.net/valorant/VCT"}, urls...)
	got := prewarmBatch(urls)
	if len(got) != prewarmMaxURLs {
		t.Fatalf("batch of %d, want %d", len(got), prewarmMaxURLs)
	}
	seen := map[string]bool{}
	for _, item := range got {
		if seen[item.key] {
			t.Fatalf("duplicate %s", item.url)
		}
		seen[item.key] = true
	}
}

func TestRedirectsStayOnLiquipediaMedia(t *testing.T) {
	check := func(target string) error {
		u, err := url.Parse(target)
		if err != nil {
			t.Fatal(err)
		}
		return followImageRedirect(&http.Request{URL: u}, nil)
	}
	if err := check("https://liquipedia.net/commons/images/a/ab/Logo.png"); err != nil {
		t.Fatalf("legit redirect refused: %v", err)
	}
	for _, target := range []string{
		"https://example.com/commons/images/a/ab/Logo.png",
		"http://169.254.169.254/latest/meta-data/",
		"https://liquipedia.net/commons/Special:FilePath/x.png",
		"https://liquipedia.net/counterstrike/Main_Page",
	} {
		if err := check(target); err == nil {
			t.Fatalf("redirect to %s followed", target)
		}
	}
}

// A maintenance window or a Cloudflare block says nothing about the file.
func TestPassingUpstreamFailureIsNotRememberedAsMissing(t *testing.T) {
	for _, status := range []int{http.StatusInternalServerError, http.StatusServiceUnavailable, http.StatusForbidden} {
		h, stub := newStubbedProxy(status)
		const raw = "https://liquipedia.net/commons/images/a/ab/Logo.png"
		key, _ := validateImageURL(raw)
		if _, err := h.fetchAndStore(t.Context(), raw, key); err == nil {
			t.Fatalf("%d: expected an error", status)
		}
		if h.recentlyMissed(key) {
			t.Fatalf("%d remembered as a missing file", status)
		}
		stub.status = http.StatusOK
		if _, err := h.fetchAndStore(t.Context(), raw, key); err != nil {
			t.Fatalf("%d: not asked again once upstream is back: %v", status, err)
		}
	}
}

func TestAnHtmlAnswerIsNotRememberedAsMissing(t *testing.T) {
	h := NewImageProxyHandler(nil, nil)
	h.httpClient.Transport = roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"text/html"}}, Body: io.NopCloser(strings.NewReader("<html>"))}, nil
	})
	const raw = "https://liquipedia.net/commons/images/a/ab/Logo.png"
	key, _ := validateImageURL(raw)
	if _, err := h.fetchAndStore(t.Context(), raw, key); err == nil {
		t.Fatal("expected an error")
	}
	if h.recentlyMissed(key) {
		t.Fatal("a challenge page remembered as a missing file")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// Thumb then original is two calls for one missing logo.
func TestMissingThumbCountsOnceTowardsThePause(t *testing.T) {
	h, stub := newStubbedProxy(http.StatusNotFound)
	const raw = "https://liquipedia.net/commons/images/thumb/a/ab/L.png/48px-L.png"
	key, _ := validateImageURL(raw)
	if _, err := h.fetchAndStore(t.Context(), raw, key); err == nil {
		t.Fatal("expected an error")
	}
	if got := stub.calls.Load(); got != 2 {
		t.Fatalf("upstream called %d times, want 2", got)
	}
	if got := h.missWindowCount.Load(); got != 1 {
		t.Fatalf("counted %d misses, want 1", got)
	}
}

func TestExpiredPauseDoesNotEraseANewerOne(t *testing.T) {
	h, _ := newStubbedProxy(http.StatusOK)
	h.throttledUntil.Store(time.Now().Add(-time.Second).Unix())
	if _, err := h.fetchOnce(t.Context(), "https://liquipedia.net/commons/images/a/ab/L.png", "k"); err != nil {
		t.Fatalf("expired pause still applied: %v", err)
	}
	if h.throttledUntil.Load() != 0 {
		t.Fatal("expired pause not cleared")
	}
}
