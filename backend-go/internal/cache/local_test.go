package cache

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newTestCache(t *testing.T) (*RedisCache, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	return NewRedisClient("redis://" + mr.Addr()), mr
}

func TestWrittenListIsReadWithoutRedis(t *testing.T) {
	rc, mr := newTestCache(t)
	ctx := context.Background()
	key := LiqMatchesPastKey("valorant")

	if err := rc.Set(ctx, key, "payload", 50*time.Minute); err != nil {
		t.Fatal(err)
	}
	before := mr.CommandCount()
	for i := 0; i < 5; i++ {
		got, err := rc.Get(ctx, key)
		if err != nil || got != "payload" {
			t.Fatalf("Get = %q, %v", got, err)
		}
	}
	if sent := mr.CommandCount() - before; sent != 0 {
		t.Fatalf("5 reads of a list this process wrote sent %d Redis commands, want 0", sent)
	}
}

func TestStaleCopyOfAListIsKeptToo(t *testing.T) {
	rc, mr := newTestCache(t)
	ctx := context.Background()
	key := StaleKey(LiqMatchesUpcomingKey("dota2"))

	_ = rc.Set(ctx, key, []byte("payload"), 6*time.Hour)
	before := mr.CommandCount()
	if got, _ := rc.Get(ctx, key); got != "payload" {
		t.Fatalf("Get = %q", got)
	}
	if sent := mr.CommandCount() - before; sent != 0 {
		t.Fatalf("read sent %d Redis commands, want 0", sent)
	}
}

func TestListReadBackFromRedisIsKept(t *testing.T) {
	rc, mr := newTestCache(t)
	ctx := context.Background()
	key := LiqTournamentsRunningKey("counterstrike")
	_ = mr.Set(key, "from-redis")
	mr.SetTTL(key, 20*time.Minute)

	before := mr.CommandCount()
	for i := 0; i < 3; i++ {
		if got, _ := rc.Get(ctx, key); got != "from-redis" {
			t.Fatalf("Get = %q", got)
		}
	}
	if sent := mr.CommandCount() - before; sent != 2 {
		t.Fatalf("3 reads sent %d Redis commands, want a GET and a TTL", sent)
	}
}

func TestListWithoutExpiryIsNotKept(t *testing.T) {
	rc, mr := newTestCache(t)
	ctx := context.Background()
	key := LiqTournamentsRunningKey("counterstrike")
	_ = mr.Set(key, "v1")

	_, _ = rc.Get(ctx, key)
	_ = mr.Set(key, "v2")
	if got, _ := rc.Get(ctx, key); got != "v2" {
		t.Fatalf("Get = %q, want the value now in Redis", got)
	}
}

func TestLocalCopyExpiresWithTheKey(t *testing.T) {
	rc, mr := newTestCache(t)
	ctx := context.Background()
	key := LiqMatchesRunningKey("valorant")

	_ = rc.Set(ctx, key, "payload", 30*time.Millisecond)
	mr.FastForward(time.Second)
	time.Sleep(40 * time.Millisecond)

	if _, err := rc.Get(ctx, key); !errors.Is(err, redis.Nil) {
		t.Fatalf("expired list: err = %v, want redis.Nil", err)
	}
}

func TestDeletedListIsNotServedFromMemory(t *testing.T) {
	rc, _ := newTestCache(t)
	ctx := context.Background()
	key := LiqMatchesPastKey("valorant")

	_ = rc.Set(ctx, key, "payload", time.Hour)
	_ = rc.Del(ctx, key)
	if _, err := rc.Get(ctx, key); !errors.Is(err, redis.Nil) {
		t.Fatalf("after Del: err = %v, want redis.Nil", err)
	}

	_ = rc.Set(ctx, key, "payload", time.Hour)
	_ = rc.DelPattern(ctx, "liq:matches:*")
	if _, err := rc.Get(ctx, key); !errors.Is(err, redis.Nil) {
		t.Fatalf("after DelPattern: err = %v, want redis.Nil", err)
	}
}

func TestOtherKeysAlwaysReadRedis(t *testing.T) {
	rc, mr := newTestCache(t)
	ctx := context.Background()

	for _, key := range []string{
		LiqMatchKey("valorant", "abc"),
		LiqMatchesByDateKey("valorant", "2026-11-12"),
		"auth:refresh:42:jti",
		"liq:img:deadbeef",
	} {
		_ = rc.Set(ctx, key, "v1", time.Hour)
		_ = mr.Set(key, "v2")
		if got, _ := rc.Get(ctx, key); got != "v2" {
			t.Errorf("%s: Get = %q, want the value now in Redis", key, got)
		}
	}
}
