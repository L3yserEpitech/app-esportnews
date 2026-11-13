package cache

import (
	"strings"
	"sync"
	"time"
)

// The poller lists weigh up to 9 MB each and every match page, calendar day and
// sitemap entry reads them whole. Read from Redis each time, they were 91 % of
// the bandwidth bill (2026-11-03). This process writes them itself, so it keeps
// what it wrote. Valid only while a single backend instance runs the poller:
// a second writer would leave this copy behind until its own expiry.
var localPrefixes = []string{
	"liq:matches:running:",
	"liq:matches:upcoming:",
	"liq:matches:past:",
	"liq:tournaments:running:",
	"liq:tournaments:upcoming:",
	"liq:tournaments:finished:",
}

func keptLocally(key string) bool {
	for _, prefix := range localPrefixes {
		if strings.HasPrefix(key, prefix) {
			return true
		}
	}
	return false
}

// localMissTTL is how long a list found absent from Redis is taken as still
// absent. In webhook mode the poller lets a list expire for minutes before it
// refreshes it, and every request in between asked Redis again. Writing the
// list (this process is its only writer) ends the wait at once.
const localMissTTL = 30 * time.Second

type localCopy struct {
	value   string
	missing bool
	expires time.Time
}

type localStore struct {
	mu    sync.RWMutex
	items map[string]localCopy
}

func newLocalStore() *localStore {
	return &localStore{items: make(map[string]localCopy)}
}

// get returns the copy of key; missing means Redis was just seen without it.
func (s *localStore) get(key string) (value string, missing, ok bool) {
	s.mu.RLock()
	item, found := s.items[key]
	s.mu.RUnlock()
	if !found {
		return "", false, false
	}
	if time.Now().After(item.expires) {
		s.drop(key)
		return "", false, false
	}
	return item.value, item.missing, true
}

func (s *localStore) putMissing(key string) {
	s.mu.Lock()
	s.items[key] = localCopy{missing: true, expires: time.Now().Add(localMissTTL)}
	s.mu.Unlock()
}

func (s *localStore) put(key, value string, ttl time.Duration) {
	s.mu.Lock()
	s.items[key] = localCopy{value: value, expires: time.Now().Add(ttl)}
	s.mu.Unlock()
}

func (s *localStore) drop(keys ...string) {
	s.mu.Lock()
	for _, key := range keys {
		delete(s.items, key)
	}
	s.mu.Unlock()
}

func (s *localStore) clear() {
	s.mu.Lock()
	s.items = make(map[string]localCopy)
	s.mu.Unlock()
}
