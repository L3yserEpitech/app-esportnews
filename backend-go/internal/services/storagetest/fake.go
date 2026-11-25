// Package storagetest gives tests a StorageService backed by an in-memory S3
// endpoint: ListObjectsV2, PutObject and DeleteObject, path-style.
package storagetest

import (
	"bufio"
	"encoding/xml"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/sirupsen/logrus"

	"github.com/esportnews/backend/internal/services"
)

const (
	BucketName = "test-bucket"
	PublicURL  = "https://media.test"
)

type Object struct {
	Body        []byte
	ContentType string
	Modified    time.Time
}

type Bucket struct {
	mu      sync.Mutex
	objects map[string]Object
	// Fail makes every call answer 500, as an unreachable bucket would.
	Fail bool
}

// New starts the fake endpoint and returns a StorageService wired to it.
func New(t testing.TB) (*services.StorageService, *Bucket) {
	t.Helper()
	b := &Bucket{objects: map[string]Object{}}
	srv := httptest.NewServer(b)
	t.Cleanup(srv.Close)

	logger := logrus.New()
	logger.SetOutput(io.Discard)
	client := s3.New(s3.Options{
		Region:           "auto",
		BaseEndpoint:     aws.String(srv.URL),
		UsePathStyle:     true,
		Credentials:      credentials.NewStaticCredentialsProvider("key", "secret", ""),
		RetryMaxAttempts: 1,
	})
	return services.NewStorageServiceWithClient(client, BucketName, PublicURL, logger), b
}

func (b *Bucket) Put(key string, body []byte, modified time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.objects[key] = Object{Body: body, Modified: modified}
}

func (b *Bucket) Get(key string) (Object, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	o, ok := b.objects[key]
	return o, ok
}

func (b *Bucket) Keys() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	keys := make([]string, 0, len(b.objects))
	for k := range b.objects {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

type listResult struct {
	XMLName               xml.Name      `xml:"http://s3.amazonaws.com/doc/2006-03-01/ ListBucketResult"`
	Name                  string        `xml:"Name"`
	Prefix                string        `xml:"Prefix"`
	KeyCount              int           `xml:"KeyCount"`
	MaxKeys               int           `xml:"MaxKeys"`
	IsTruncated           bool          `xml:"IsTruncated"`
	NextContinuationToken string        `xml:"NextContinuationToken,omitempty"`
	Contents              []listContent `xml:"Contents"`
}

type listContent struct {
	Key          string `xml:"Key"`
	LastModified string `xml:"LastModified"`
	ETag         string `xml:"ETag"`
	Size         int    `xml:"Size"`
	StorageClass string `xml:"StorageClass"`
}

func (b *Bucket) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if b.Fail {
		http.Error(w, "<Error><Code>InternalError</Code></Error>", http.StatusInternalServerError)
		return
	}
	rest, ok := strings.CutPrefix(r.URL.Path, "/"+BucketName)
	if !ok {
		http.Error(w, "<Error><Code>NoSuchBucket</Code></Error>", http.StatusNotFound)
		return
	}
	key := strings.TrimPrefix(rest, "/")
	switch {
	case r.Method == http.MethodGet && key == "" && r.URL.Query().Get("list-type") == "2":
		b.list(w, r.URL.Query())
	case r.Method == http.MethodPut && key != "":
		body, err := readBody(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		b.mu.Lock()
		b.objects[key] = Object{Body: body, ContentType: r.Header.Get("Content-Type"), Modified: time.Now()}
		b.mu.Unlock()
		w.Header().Set("ETag", `"fake"`)
		w.WriteHeader(http.StatusOK)
	case r.Method == http.MethodDelete && key != "":
		b.mu.Lock()
		delete(b.objects, key)
		b.mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "<Error><Code>NotImplemented</Code></Error>", http.StatusNotImplemented)
	}
}

func (b *Bucket) list(w http.ResponseWriter, q url.Values) {
	prefix := q.Get("prefix")
	maxKeys := 1000
	if n, err := strconv.Atoi(q.Get("max-keys")); err == nil && n > 0 {
		maxKeys = n
	}
	// The continuation token is the last key of the previous page.
	after := q.Get("continuation-token")

	var keys []string
	for _, k := range b.Keys() {
		if strings.HasPrefix(k, prefix) && k > after {
			keys = append(keys, k)
		}
	}
	res := listResult{Name: BucketName, Prefix: prefix, MaxKeys: maxKeys}
	if len(keys) > maxKeys {
		keys = keys[:maxKeys]
		res.IsTruncated = true
		res.NextContinuationToken = keys[len(keys)-1]
	}
	b.mu.Lock()
	for _, k := range keys {
		o := b.objects[k]
		name := k
		if q.Get("encoding-type") == "url" {
			name = url.QueryEscape(k)
		}
		res.Contents = append(res.Contents, listContent{
			Key:          name,
			LastModified: o.Modified.UTC().Format("2006-01-02T15:04:05.000Z"),
			ETag:         `"fake"`,
			Size:         len(o.Body),
			StorageClass: "STANDARD",
		})
	}
	b.mu.Unlock()
	res.KeyCount = len(res.Contents)
	w.Header().Set("Content-Type", "application/xml")
	_ = xml.NewEncoder(w).Encode(res)
}

// readBody undoes the aws-chunked framing the SDK uses when it sends a
// trailing checksum.
func readBody(r *http.Request) ([]byte, error) {
	if !strings.Contains(r.Header.Get("Content-Encoding"), "aws-chunked") &&
		!strings.HasPrefix(r.Header.Get("X-Amz-Content-Sha256"), "STREAMING-") {
		return io.ReadAll(r.Body)
	}
	var out []byte
	reader := bufio.NewReader(r.Body)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		size, err := strconv.ParseInt(strings.SplitN(strings.TrimSpace(line), ";", 2)[0], 16, 64)
		if err != nil {
			return nil, err
		}
		if size == 0 {
			return out, nil
		}
		chunk := make([]byte, size)
		if _, err := io.ReadFull(reader, chunk); err != nil {
			return nil, err
		}
		out = append(out, chunk...)
		if _, err := reader.Discard(2); err != nil {
			return nil, err
		}
	}
}
