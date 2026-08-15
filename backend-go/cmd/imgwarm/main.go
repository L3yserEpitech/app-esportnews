// imgwarm fetches Liquipedia image URLs (one per line on stdin) from the local
// network and uploads them to the R2 image tier (liq-images/<sha256-url>), so
// the image proxy serves them as HIT-R2 without ever hitting Liquipedia from
// the backend. Meant to run on a host whose IP isn't blocked:
//
//	... | go run ./cmd/imgwarm
package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/services"
)

const (
	userAgent   = "EsportNews/1.0 (contact@esportnews.fr)"
	concurrency = 4
	spacing     = 150 * time.Millisecond
)

var thumbRe = regexp.MustCompile(`^(https://[^/]+/commons)/images/thumb/(./../([^/]+))/\d+px-[^/]+$`)
var wikiHintRe = regexp.MustCompile(`^([^?]+)\?w=([a-z0-9]+)$`)

func fetch(client *http.Client, rawURL string) (string, []byte, error) {
	req, _ := http.NewRequest(http.MethodGet, rawURL, nil)
	req.Header.Set("User-Agent", userAgent)
	resp, err := client.Do(req)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		return "", nil, fmt.Errorf("not an image: %s", ct)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024))
	return ct, data, err
}

func main() {
	_ = godotenv.Load(".env", "../.env")
	logger := logrus.New()
	logger.SetLevel(logrus.WarnLevel)

	storage, err := services.NewStorageService(
		os.Getenv("CLOUDFLARE_R2_ENDPOINT"),
		os.Getenv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
		os.Getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
		os.Getenv("CLOUDFLARE_R2_BUCKET_NAME"),
		os.Getenv("CLOUDFLARE_R2_PUBLIC_URL"),
		logger,
	)
	if err != nil || !storage.Enabled() {
		fmt.Fprintln(os.Stderr, "R2 not configured (check CLOUDFLARE_R2_* in .env)")
		os.Exit(1)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	urls := make(chan string)
	var ok, failed int32
	var wg sync.WaitGroup

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for u := range urls {
				time.Sleep(spacing)
				fetchURL, wikiHint := u, ""
				if m := wikiHintRe.FindStringSubmatch(u); m != nil {
					fetchURL, wikiHint = m[1], m[2]
				}
				ct, data, err := fetch(client, fetchURL)
				if err != nil {
					// Missing thumb → commons original → game-wiki FilePath.
					if m := thumbRe.FindStringSubmatch(fetchURL); m != nil {
						ct, data, err = fetch(client, m[1]+"/images/"+m[2])
						if err != nil && wikiHint != "" {
							ct, data, err = fetch(client, "https://liquipedia.net/"+wikiHint+"/Special:FilePath/"+m[3])
						}
					}
				}
				if err != nil {
					fmt.Printf("FAIL %v  %s\n", err, u)
					atomic.AddInt32(&failed, 1)
					continue
				}
				key := fmt.Sprintf("%x", sha256.Sum256([]byte(u)))
				ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
				_, uerr := storage.Upload(ctx, services.UploadOptions{
					Path:        "liq-images",
					Filename:    key,
					ContentType: ct,
					Body:        bytes.NewReader(data),
					Size:        int64(len(data)),
				})
				cancel()
				if uerr != nil {
					fmt.Printf("FAIL upload %v  %s\n", uerr, u)
					atomic.AddInt32(&failed, 1)
					continue
				}
				fmt.Printf("OK   %6d B  %s\n", len(data), u)
				atomic.AddInt32(&ok, 1)
			}
		}()
	}

	sc := bufio.NewScanner(os.Stdin)
	seen := map[string]bool{}
	for sc.Scan() {
		u := strings.TrimSpace(sc.Text())
		if u == "" || seen[u] || !strings.HasPrefix(u, "https://liquipedia.net/") {
			continue
		}
		seen[u] = true
		urls <- u
	}
	close(urls)
	wg.Wait()
	fmt.Printf("\nDone: %d ok, %d failed\n", ok, failed)
}
