package cache

import (
	"context"
	"errors"
	"sync"
	"time"
)

var ErrCacheKeyNotFound = errors.New("cache key not found")

// MockRedisCache implements RedisCache interface for testing
type MockRedisCache struct {
	data map[string]string
	mu   sync.RWMutex
}

// NewMockRedisCache creates a new mock Redis cache
func NewMockRedisCache() *MockRedisCache {
	return &MockRedisCache{
		data: make(map[string]string),
	}
}

// Set stores a value with optional expiration
func (m *MockRedisCache) Set(ctx context.Context, key string, value string, expiration time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = value
	return nil
}

// Get retrieves a value by key
func (m *MockRedisCache) Get(ctx context.Context, key string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if val, exists := m.data[key]; exists {
		return val, nil
	}
	return "", ErrCacheKeyNotFound
}

// Delete removes a key from cache
func (m *MockRedisCache) Delete(ctx context.Context, keys ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, key := range keys {
		delete(m.data, key)
	}
	return nil
}

// Exists checks if a key exists
func (m *MockRedisCache) Exists(ctx context.Context, keys ...string) (int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := int64(0)
	for _, key := range keys {
		if _, exists := m.data[key]; exists {
			count++
		}
	}
	return count, nil
}

// Clear removes all keys from cache
func (m *MockRedisCache) Clear(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data = make(map[string]string)
	return nil
}

// GetAll retrieves all keys matching a pattern (simple implementation)
func (m *MockRedisCache) GetAll(ctx context.Context, pattern string) ([]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	// Simple pattern matching - just returns all keys for mock
	var keys []string
	for key := range m.data {
		keys = append(keys, key)
	}
	return keys, nil
}

// Close closes the cache connection
func (m *MockRedisCache) Close() error {
	return m.Clear(context.Background())
}
