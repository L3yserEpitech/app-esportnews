package cache

import (
	"context"
	"crypto/tls"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

type RedisCache struct {
	client *redis.Client
	local  *localStore
}

func NewRedisClient(redisURL string) *RedisCache {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		logrus.Warnf("Invalid Redis URL, using defaults: %v", err)
		opt = &redis.Options{
			Addr: "localhost:6379",
		}
	}

	// Enable TLS for Upstash (rediss:// scheme)
	if opt.TLSConfig == nil && len(redisURL) >= 9 && redisURL[0:9] == "rediss://" {
		opt.TLSConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		logrus.Warnf("Failed to connect to Redis: %v", err)
	} else {
		logrus.Info("Redis connected successfully")
	}

	return &RedisCache{client: client, local: newLocalStore()}
}

// Get retrieves a value from Redis
func (rc *RedisCache) Get(ctx context.Context, key string) (string, error) {
	if !keptLocally(key) {
		return rc.client.Get(ctx, key).Result()
	}
	if value, missing, ok := rc.local.get(key); ok {
		if missing {
			return "", redis.Nil
		}
		return value, nil
	}
	value, err := rc.client.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		rc.local.putMissing(key)
	}
	if err == nil {
		// Keep it exactly as long as Redis will: the poller only refreshes a list
		// once its key is gone, so a copy outliving it would delay the refresh.
		if ttl, ttlErr := rc.client.TTL(ctx, key).Result(); ttlErr == nil && ttl > 0 {
			rc.local.put(key, value, ttl)
		}
	}
	return value, err
}

// Set stores a value in Redis with expiration
func (rc *RedisCache) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	err := rc.client.Set(ctx, key, value, expiration).Err()
	if keptLocally(key) {
		rc.keepLocally(key, value, expiration, err)
	}
	return err
}

// keepLocally mirrors a list just written to Redis. Anything it cannot mirror
// exactly drops the copy, so a read never returns what Redis no longer holds.
func (rc *RedisCache) keepLocally(key string, value interface{}, expiration time.Duration, writeErr error) {
	var text string
	switch v := value.(type) {
	case string:
		text = v
	case []byte:
		text = string(v)
	default:
		rc.local.drop(key)
		return
	}
	if writeErr != nil || expiration <= 0 {
		rc.local.drop(key)
		return
	}
	rc.local.put(key, text, expiration)
}

// Del deletes one or more keys
func (rc *RedisCache) Del(ctx context.Context, keys ...string) error {
	rc.local.drop(keys...)
	return rc.client.Del(ctx, keys...).Err()
}

// MGet reads several keys in one round trip; a missing key comes back empty.
func (rc *RedisCache) MGet(ctx context.Context, keys ...string) ([]string, error) {
	raw, err := rc.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}
	values := make([]string, len(raw))
	for i, v := range raw {
		if str, ok := v.(string); ok {
			values[i] = str
		}
	}
	return values, nil
}

// GetDel reads and removes a key atomically; a missing key comes back empty.
func (rc *RedisCache) GetDel(ctx context.Context, key string) (string, error) {
	value, err := rc.client.GetDel(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return "", nil
	}
	return value, err
}

// SetNX stores a key only if it doesn't exist, and reports whether it did the storing.
func (rc *RedisCache) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	return rc.client.SetNX(ctx, key, value, expiration).Result()
}

// DelPattern deletes every key matching a glob pattern. Uses SCAN so it
// stays cheap on large keyspaces (KEYS would block the server). Errors
// from individual DELs are swallowed — invalidation is best-effort and a
// stale entry will expire on its own TTL anyway.
func (rc *RedisCache) DelPattern(ctx context.Context, pattern string) error {
	rc.local.clear()
	iter := rc.client.Scan(ctx, 0, pattern, 100).Iterator()
	var batch []string
	for iter.Next(ctx) {
		batch = append(batch, iter.Val())
		if len(batch) >= 100 {
			_ = rc.client.Del(ctx, batch...).Err()
			batch = batch[:0]
		}
	}
	if err := iter.Err(); err != nil {
		return err
	}
	if len(batch) > 0 {
		return rc.client.Del(ctx, batch...).Err()
	}
	return nil
}

// Exists checks if a key exists
func (rc *RedisCache) Exists(ctx context.Context, key string) (bool, error) {
	val, err := rc.client.Exists(ctx, key).Result()
	return val > 0, err
}

// Incr increments a counter
func (rc *RedisCache) Incr(ctx context.Context, key string) (int64, error) {
	return rc.client.Incr(ctx, key).Result()
}

// Expire sets expiration on a key
func (rc *RedisCache) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return rc.client.Expire(ctx, key, expiration).Err()
}

// TTL returns the remaining TTL of a key (-1 if no expiry, -2 if key doesn't exist)
func (rc *RedisCache) TTL(ctx context.Context, key string) (time.Duration, error) {
	return rc.client.TTL(ctx, key).Result()
}

// Close closes the Redis connection
func (rc *RedisCache) Close() error {
	return rc.client.Close()
}

// GetClient returns the underlying Redis client for advanced operations
func (rc *RedisCache) GetClient() *redis.Client {
	return rc.client
}
