package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"
)

const (
	expoPushURL    = "https://exp.host/--/api/v2/push/send"
	maxBatchSize   = 100
	pushHTTPTimeout = 10 * time.Second
)

// ExpoPushMessage represents a single push notification
type ExpoPushMessage struct {
	To       []string               `json:"to"`
	Title    string                 `json:"title"`
	Body     string                 `json:"body"`
	Data     map[string]interface{} `json:"data,omitempty"`
	Sound    string                 `json:"sound,omitempty"`
	Priority string                 `json:"priority,omitempty"`
	Badge    *int                   `json:"badge,omitempty"`
}

// ExpoPushTicket represents the response for a single push notification
type ExpoPushTicket struct {
	Status  string `json:"status"` // "ok" or "error"
	ID      string `json:"id"`
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"` // e.g. "DeviceNotRegistered"
	} `json:"details,omitempty"`
}

// ExpoPushResponse is the API response
type ExpoPushResponse struct {
	Data []ExpoPushTicket `json:"data"`
}

// ExpoPushService sends push notifications via Expo Push API
type ExpoPushService struct {
	httpClient *http.Client
	logger     *logrus.Logger
}

func NewExpoPushService(logger *logrus.Logger) *ExpoPushService {
	return &ExpoPushService{
		httpClient: &http.Client{Timeout: pushHTTPTimeout},
		logger:     logger,
	}
}

// SendBatch sends push notifications in batches of 100
// Returns a list of tokens that should be deactivated (DeviceNotRegistered)
func (s *ExpoPushService) SendBatch(ctx context.Context, messages []ExpoPushMessage) ([]string, error) {
	if len(messages) == 0 {
		return nil, nil
	}

	var invalidTokens []string

	// Send in chunks of maxBatchSize
	for i := 0; i < len(messages); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(messages) {
			end = len(messages)
		}
		chunk := messages[i:end]

		tokens, err := s.sendChunk(ctx, chunk)
		if err != nil {
			s.logger.Errorf("[ExpoPush] Failed to send chunk %d-%d: %v", i, end, err)
			continue
		}
		invalidTokens = append(invalidTokens, tokens...)
	}

	return invalidTokens, nil
}

func (s *ExpoPushService) sendChunk(ctx context.Context, messages []ExpoPushMessage) ([]string, error) {
	body, err := json.Marshal(messages)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal messages: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoPushURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("expo push API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var pushResp ExpoPushResponse
	if err := json.Unmarshal(respBody, &pushResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Collect invalid tokens
	var invalidTokens []string
	for idx, ticket := range pushResp.Data {
		if ticket.Status == "error" {
			s.logger.Warnf("[ExpoPush] Ticket error: %s - %s", ticket.Details.Error, ticket.Message)
			if ticket.Details.Error == "DeviceNotRegistered" && idx < len(messages) {
				// Collect all tokens from the failed message
				invalidTokens = append(invalidTokens, messages[idx].To...)
			}
		}
	}

	s.logger.Infof("[ExpoPush] Sent %d notifications, %d invalid tokens", len(messages), len(invalidTokens))
	return invalidTokens, nil
}
