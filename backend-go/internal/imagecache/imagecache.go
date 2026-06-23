// Package imagecache defines the shared Redis key scheme and value encoding for
// proxied Liquipedia images, so the image proxy (reader) and the background
// warmer (writer) always agree on keys and format.
package imagecache

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"time"
)

const (
	RedisPrefix = "liq:img:"
	RedisTTL    = 7 * 24 * time.Hour
	// MaxBytes caps which images go to Redis. Logos are a few KB–hundreds of KB.
	MaxBytes = 1 * 1024 * 1024
)

var allowedHosts = map[string]bool{
	"liquipedia.net":     true,
	"www.liquipedia.net": true,
}

// AllowedHost reports whether rawURL is an https URL on an allowed image host.
func AllowedHost(rawURL string) bool {
	if !strings.HasPrefix(rawURL, "https://") {
		return false
	}
	hostPart := strings.TrimPrefix(rawURL, "https://")
	slash := strings.IndexByte(hostPart, '/')
	if slash < 0 {
		return false
	}
	return allowedHosts[strings.ToLower(hostPart[:slash])]
}

// CacheKey is the stable per-URL key (sha256 hex), shared by the L1 map and Redis.
func CacheKey(rawURL string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(rawURL)))
}

// RedisKey is the full Redis key for a cache key.
func RedisKey(cacheKey string) string { return RedisPrefix + cacheKey }

// Encode/Decode store an image as "<content-type>\n<raw bytes>" (the content
// type never contains a newline).
func Encode(contentType string, data []byte) string {
	return contentType + "\n" + string(data)
}

func Decode(val string) (contentType string, data []byte, ok bool) {
	nl := strings.IndexByte(val, '\n')
	if nl < 0 {
		return "", nil, false
	}
	return val[:nl], []byte(val[nl+1:]), true
}
