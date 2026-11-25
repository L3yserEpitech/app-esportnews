package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

const (
	expoDefaultBaseURL = "https://exp.host"
	expoSendPath       = "/--/api/v2/push/send"
	expoReceiptsPath   = "/--/api/v2/push/getReceipts"
	maxBatchSize       = 100
	// Expo refuses more than 1000 ids per getReceipts call (PUSH_TOO_MANY_RECEIPTS).
	maxReceiptBatchSize = 1000
	pushHTTPTimeout     = 10 * time.Second
	// Expo allows 600 notifications per second per project: a chunk of 100
	// every 170 ms stays under it whatever the size of the broadcast.
	minChunkInterval = 170 * time.Millisecond

	PushErrorDeviceNotRegistered = "DeviceNotRegistered"
	// PushErrorNotSent marks a message Expo never answered for (request failed,
	// ticket missing from the response).
	PushErrorNotSent = "NotSent"

	PushKindArticle = "article"
	PushKindMatch   = "match"
	PushKindManual  = "manual"

	PushAudienceAll   = "Tous les appareils"
	PushAudienceMatch = "Abonnés au match"

	// Android channels the app creates (mobile-app/utils/notifications.ts).
	PushChannelContent = "content-updates"
	PushChannelMatch   = "match-alerts"
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
	// ChannelId routes the notification to a specific Android notification channel
	// (created client-side via setNotificationChannelAsync). Android-only — iOS ignores it.
	ChannelId string `json:"channelId,omitempty"`
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

// ExpoPushReceipt is what Apple or Google answered for one ticket. "ok" means
// their push service took the notification, not that the device showed it.
type ExpoPushReceipt struct {
	Status  string `json:"status"` // "ok" or "error"
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"`
	} `json:"details,omitempty"`
}

// PushResult is the outcome of one notification for one device.
type PushResult struct {
	Token    string
	TicketID string // empty when Expo refused the message
	Error    string // empty when Expo took it
}

func (r PushResult) OK() bool { return r.Error == "" }

// PushRecord describes one send (an article broadcast, the alert of one match,
// a manual push) for whoever keeps the history.
type PushRecord struct {
	Kind     string // "article", "match" or "manual"
	Title    string
	Body     string
	Audience string
	Ref      string
	ActorID  int64
	Results  []PushResult
}

// PushRecorder keeps the history of sends. The back-office implements it.
type PushRecorder interface {
	RecordPush(ctx context.Context, record PushRecord)
}

// ExpoPushService sends push notifications via Expo Push API
type ExpoPushService struct {
	httpClient *http.Client
	logger     *logrus.Logger
	baseURL    string
	recorder   PushRecorder
}

func NewExpoPushService(logger *logrus.Logger) *ExpoPushService {
	baseURL := expoDefaultBaseURL
	// EXPO_PUSH_BASE_URL points the client at a stand-in (tests, local runs
	// with seeded tokens). Never set it in production.
	if override := os.Getenv("EXPO_PUSH_BASE_URL"); override != "" {
		baseURL = strings.TrimRight(override, "/")
	}
	return &ExpoPushService{
		httpClient: &http.Client{Timeout: pushHTTPTimeout},
		logger:     logger,
		baseURL:    baseURL,
	}
}

// SetRecorder must be called before anything sends: it is not synchronized.
func (s *ExpoPushService) SetRecorder(r PushRecorder) { s.recorder = r }

// Record hands a send to the recorder. A history that can't be written never
// costs the send.
func (s *ExpoPushService) Record(ctx context.Context, record PushRecord) {
	if s == nil || s.recorder == nil || len(record.Results) == 0 {
		return
	}
	defer func() {
		if r := recover(); r != nil {
			s.logger.Errorf("[ExpoPush] recorder panicked: %v", r)
		}
	}()
	s.recorder.RecordPush(ctx, record)
}

// InvalidTokens lists the devices Expo reported as gone.
func InvalidTokens(results []PushResult) []string {
	var tokens []string
	for _, r := range results {
		if r.Error == PushErrorDeviceNotRegistered {
			tokens = append(tokens, r.Token)
		}
	}
	return tokens
}

// Send hands the messages to Expo, 100 at a time, and returns one result per
// recipient, in order. A message with several recipients is split first: the
// documentation only guarantees that tickets follow the order of the messages.
func (s *ExpoPushService) Send(ctx context.Context, messages []ExpoPushMessage) []PushResult {
	var flat []ExpoPushMessage
	for _, m := range messages {
		for _, token := range m.To {
			single := m
			single.To = []string{token}
			flat = append(flat, single)
		}
	}

	results := make([]PushResult, 0, len(flat))
	for i := 0; i < len(flat); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(flat) {
			end = len(flat)
		}
		chunk := flat[i:end]
		started := time.Now()

		tickets, err := s.sendChunk(ctx, chunk)
		if err != nil {
			s.logger.Errorf("[ExpoPush] Failed to send chunk %d-%d: %v", i, end, err)
		}
		for idx, msg := range chunk {
			result := PushResult{Token: msg.To[0]}
			switch {
			case idx >= len(tickets):
				result.Error = PushErrorNotSent
			case tickets[idx].Status == "ok" && tickets[idx].ID != "":
				result.TicketID = tickets[idx].ID
			default:
				result.Error = tickets[idx].Details.Error
				if result.Error == "" {
					result.Error = PushErrorNotSent
				}
				s.logger.Warnf("[ExpoPush] Ticket error: %s - %s", tickets[idx].Details.Error, tickets[idx].Message)
			}
			results = append(results, result)
		}

		if end < len(flat) {
			if wait := minChunkInterval - time.Since(started); wait > 0 {
				select {
				case <-ctx.Done():
				case <-time.After(wait):
				}
			}
		}
	}
	return results
}

// SendBatch sends push notifications in batches of 100
// Returns a list of tokens that should be deactivated (DeviceNotRegistered)
func (s *ExpoPushService) SendBatch(ctx context.Context, messages []ExpoPushMessage) ([]string, error) {
	return InvalidTokens(s.Send(ctx, messages)), nil
}

func (s *ExpoPushService) post(ctx context.Context, path string, payload interface{}) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+path, bytes.NewReader(body))
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

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("expo push API returned status %d: %.300s", resp.StatusCode, string(respBody))
	}
	return respBody, nil
}

func (s *ExpoPushService) sendChunk(ctx context.Context, messages []ExpoPushMessage) ([]ExpoPushTicket, error) {
	respBody, err := s.post(ctx, expoSendPath, messages)
	if err != nil {
		return nil, err
	}

	var pushResp ExpoPushResponse
	if err := json.Unmarshal(respBody, &pushResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	if len(pushResp.Data) != len(messages) {
		s.logger.Warnf("[ExpoPush] %d tickets for %d messages", len(pushResp.Data), len(messages))
	}

	s.logger.Infof("[ExpoPush] Sent %d notifications", len(messages))
	return pushResp.Data, nil
}

// GetReceipts asks Expo what Apple and Google answered for these tickets. A
// ticket missing from the map has no receipt yet, or no longer: Expo advises
// to ask 15 minutes after the send and clears receipts after 24 hours.
func (s *ExpoPushService) GetReceipts(ctx context.Context, ticketIDs []string) (map[string]ExpoPushReceipt, error) {
	receipts := make(map[string]ExpoPushReceipt, len(ticketIDs))
	for i := 0; i < len(ticketIDs); i += maxReceiptBatchSize {
		end := i + maxReceiptBatchSize
		if end > len(ticketIDs) {
			end = len(ticketIDs)
		}
		respBody, err := s.post(ctx, expoReceiptsPath, map[string][]string{"ids": ticketIDs[i:end]})
		if err != nil {
			return receipts, err
		}
		var parsed struct {
			Data map[string]ExpoPushReceipt `json:"data"`
		}
		if err := json.Unmarshal(respBody, &parsed); err != nil {
			return receipts, fmt.Errorf("failed to parse receipts: %w", err)
		}
		for id, receipt := range parsed.Data {
			receipts[id] = receipt
		}
	}
	return receipts, nil
}
