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

type localCopy struct {
	value   string
	expires time.Time
}

type localStore struct {
	mu    sync.RWMutex
	items map[string]localCopy
}

func newLocalStore() *localStore {
	return &localStore{items: make(map[string]localCopy)}
}

func (s *localStore) get(key string) (string, bool) {
	s.mu.RLock()
	item, ok := s.items[key]
	s.mu.RUnlock()
	if !ok {
		return "", false
	}
	if time.Now().After(item.expires) {
		s.drop(key)
		return "", false
	}
	return item.value, true
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
