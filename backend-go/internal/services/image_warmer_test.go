package services

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/cache"
	"github.com/esportnews/backend/internal/imagecache"
)

func TestWarmerAsksRedisOncePerCachedImage(t *testing.T) {
	mr := miniredis.RunT(t)
	rc := cache.NewRedisClient("redis://" + mr.Addr())
	w := NewImageWarmer(rc, logrus.New())

	urls := []string{
		"https://liquipedia.net/commons/images/a.png",
		"https://liquipedia.net/commons/images/b.png",
	}
	for _, u := range urls {
		_ = mr.Set(imagecache.RedisKey(imagecache.CacheKey(u)), "image/png\nx")
	}

	before := mr.CommandCount()
	w.WarmURLs(context.Background(), urls)
	if sent := mr.CommandCount() - before; sent != 2 {
		t.Fatalf("first pass sent %d Redis commands, want 2", sent)
	}

	before = mr.CommandCount()
	for i := 0; i < 5; i++ {
		w.WarmURLs(context.Background(), urls)
	}
	if sent := mr.CommandCount() - before; sent != 0 {
		t.Fatalf("5 more passes over cached images sent %d Redis commands, want 0", sent)
	}
}
