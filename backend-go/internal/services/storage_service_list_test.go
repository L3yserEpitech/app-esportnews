package services_test

import (
	"bytes"
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/esportnews/backend/internal/services"
	"github.com/esportnews/backend/internal/services/storagetest"
)

func TestStorageListPagesThroughAPrefix(t *testing.T) {
	storage, bucket := storagetest.New(t)
	day := time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC)
	for i := 0; i < 5; i++ {
		bucket.Put(fmt.Sprintf("ads/images/%d.png", i), bytes.Repeat([]byte("x"), 10+i), day.Add(time.Duration(i)*time.Hour))
	}
	bucket.Put("ads/images/", nil, day)
	bucket.Put("articles/covers/images/a.jpg", []byte("cover"), day)
	bucket.Put("liq-images/logo.png", []byte("cache"), day)

	ctx := context.Background()
	first, cursor, err := storage.List(ctx, "ads/images/", "", 2)
	require.NoError(t, err)
	require.NotEmpty(t, cursor)

	var keys []string
	page, next := first, cursor
	for {
		for _, o := range page {
			keys = append(keys, o.Key)
		}
		if next == "" {
			break
		}
		page, next, err = storage.List(ctx, "ads/images/", next, 2)
		require.NoError(t, err)
	}
	assert.Equal(t, []string{"ads/images/0.png", "ads/images/1.png", "ads/images/2.png", "ads/images/3.png", "ads/images/4.png"}, keys,
		"every object of the prefix once, the folder marker and other prefixes left out")

	var third services.StoredObject
	all, _, err := storage.List(ctx, "ads/images/", "", 100)
	require.NoError(t, err)
	for _, o := range all {
		if o.Key == "ads/images/3.png" {
			third = o
		}
	}
	assert.Equal(t, storagetest.PublicURL+"/ads/images/3.png", third.URL)
	assert.Equal(t, int64(13), third.Size)
	assert.True(t, third.LastModified.Equal(day.Add(3*time.Hour)))
}

func TestStorageListReportsAnUnreachableBucket(t *testing.T) {
	storage, bucket := storagetest.New(t)
	bucket.Fail = true
	_, _, err := storage.List(context.Background(), "ads/images/", "", 10)
	assert.Error(t, err)
}

func TestStorageUploadThenDeleteByURL(t *testing.T) {
	storage, bucket := storagetest.New(t)
	ctx := context.Background()
	body := []byte("\x89PNG fake image")

	url, err := storage.Upload(ctx, services.UploadOptions{
		Path: "ads/images", Filename: "banner.png", ContentType: "image/png", Body: bytes.NewReader(body), Size: int64(len(body)),
	})
	require.NoError(t, err)
	assert.Equal(t, storagetest.PublicURL+"/ads/images/banner.png", url)
	stored, ok := bucket.Get("ads/images/banner.png")
	require.True(t, ok)
	assert.Equal(t, body, stored.Body)
	assert.Equal(t, "image/png", stored.ContentType)

	require.NoError(t, storage.Delete(ctx, url))
	assert.Empty(t, bucket.Keys())
}

func TestStorageKeyFromURL(t *testing.T) {
	storage, _ := storagetest.New(t)
	key, ok := storage.KeyFromURL(storagetest.PublicURL + "/articles/covers/images/a.jpg")
	assert.True(t, ok)
	assert.Equal(t, "articles/covers/images/a.jpg", key)

	for _, foreign := range []string{
		"https://i.postimg.cc/abc/banner.png",
		storagetest.PublicURL,
		storagetest.PublicURL + "/",
		storagetest.PublicURL + ".evil.test/ads/images/a.png",
		storagetest.PublicURL + "/ads/images/a.png?x=1",
	} {
		_, ok := storage.KeyFromURL(foreign)
		assert.False(t, ok, foreign)
	}
}
