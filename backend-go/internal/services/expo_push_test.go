package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeExpo stands in for exp.host: no test ever talks to the real service.
type fakeExpo struct {
	mu sync.Mutex
	// ticketFor decides the ticket of a token; nil = every message is taken.
	ticketFor    func(token string) ExpoPushTicket
	receipts     map[string]ExpoPushReceipt
	sendStatus   int
	sendCalls    [][]ExpoPushMessage
	receiptCalls [][]string
	nextTicket   int
}

func (f *fakeExpo) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		body, _ := io.ReadAll(r.Body)
		switch r.URL.Path {
		case expoSendPath:
			var messages []ExpoPushMessage
			if err := json.Unmarshal(body, &messages); err != nil {
				http.Error(w, "bad body", http.StatusBadRequest)
				return
			}
			f.sendCalls = append(f.sendCalls, messages)
			if f.sendStatus != 0 {
				w.WriteHeader(f.sendStatus)
				fmt.Fprint(w, `{"errors":[{"code":"TOO_MANY_REQUESTS","message":"slow down"}]}`)
				return
			}
			tickets := make([]ExpoPushTicket, 0, len(messages))
			for _, m := range messages {
				ticket := ExpoPushTicket{Status: "ok"}
				if f.ticketFor != nil {
					ticket = f.ticketFor(m.To[0])
				}
				if ticket.Status == "ok" && ticket.ID == "" {
					f.nextTicket++
					ticket.ID = fmt.Sprintf("ticket-%d", f.nextTicket)
				}
				tickets = append(tickets, ticket)
			}
			_ = json.NewEncoder(w).Encode(ExpoPushResponse{Data: tickets})
		case expoReceiptsPath:
			var req struct {
				IDs []string `json:"ids"`
			}
			if err := json.Unmarshal(body, &req); err != nil || req.IDs == nil {
				http.Error(w, "bad body", http.StatusBadRequest)
				return
			}
			f.receiptCalls = append(f.receiptCalls, req.IDs)
			data := map[string]ExpoPushReceipt{}
			for _, id := range req.IDs {
				if receipt, ok := f.receipts[id]; ok {
					data[id] = receipt
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"data": data})
		default:
			http.NotFound(w, r)
		}
	})
}

func errorTicket(code string) ExpoPushTicket {
	t := ExpoPushTicket{Status: "error", Message: code}
	t.Details.Error = code
	return t
}

func newTestPushService(t *testing.T, fake *fakeExpo) *ExpoPushService {
	t.Helper()
	srv := httptest.NewServer(fake.handler())
	t.Cleanup(srv.Close)
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	svc := NewExpoPushService(logger)
	svc.baseURL = srv.URL
	return svc
}

func TestExpoBaseURLComesFromTheEnvironment(t *testing.T) {
	logger := logrus.New()
	t.Setenv("EXPO_PUSH_BASE_URL", "")
	assert.Equal(t, "https://exp.host", NewExpoPushService(logger).baseURL)
	t.Setenv("EXPO_PUSH_BASE_URL", "http://127.0.0.1:9/")
	assert.Equal(t, "http://127.0.0.1:9", NewExpoPushService(logger).baseURL)
}

func TestSend_OneResultPerRecipientInOrder(t *testing.T) {
	fake := &fakeExpo{ticketFor: func(token string) ExpoPushTicket {
		switch token {
		case "gone":
			return errorTicket(PushErrorDeviceNotRegistered)
		case "odd":
			return ExpoPushTicket{Status: "error", Message: "no detail"}
		}
		return ExpoPushTicket{Status: "ok", ID: "id-" + token}
	}}
	svc := newTestPushService(t, fake)

	results := svc.Send(context.Background(), []ExpoPushMessage{
		{To: []string{"a"}, Title: "T", Body: "B"},
		// Several recipients: split, so that each one gets its own ticket.
		{To: []string{"b", "gone"}, Title: "T", Body: "B"},
		{To: []string{"odd"}, Title: "T", Body: "B"},
	})

	require.Len(t, fake.sendCalls, 1)
	require.Len(t, fake.sendCalls[0], 4)
	for _, m := range fake.sendCalls[0] {
		assert.Len(t, m.To, 1)
	}
	assert.Equal(t, []PushResult{
		{Token: "a", TicketID: "id-a"},
		{Token: "b", TicketID: "id-b"},
		{Token: "gone", Error: PushErrorDeviceNotRegistered},
		{Token: "odd", Error: PushErrorNotSent},
	}, results)
	assert.Equal(t, []string{"gone"}, InvalidTokens(results))

	invalid, err := svc.SendBatch(context.Background(), []ExpoPushMessage{{To: []string{"gone", "a"}}})
	require.NoError(t, err)
	assert.Equal(t, []string{"gone"}, invalid)
}

func TestSend_ChunksOfAHundred(t *testing.T) {
	fake := &fakeExpo{}
	svc := newTestPushService(t, fake)

	messages := make([]ExpoPushMessage, 205)
	for i := range messages {
		messages[i] = ExpoPushMessage{To: []string{fmt.Sprintf("tok-%d", i)}}
	}
	results := svc.Send(context.Background(), messages)

	require.Len(t, fake.sendCalls, 3)
	assert.Len(t, fake.sendCalls[0], 100)
	assert.Len(t, fake.sendCalls[1], 100)
	assert.Len(t, fake.sendCalls[2], 5)
	require.Len(t, results, 205)
	seen := map[string]bool{}
	for i, r := range results {
		assert.Equal(t, fmt.Sprintf("tok-%d", i), r.Token)
		assert.True(t, r.OK())
		seen[r.TicketID] = true
	}
	assert.Len(t, seen, 205, "every device keeps its own ticket")
}

func TestSend_AFailedRequestFailsItsMessagesOnly(t *testing.T) {
	fake := &fakeExpo{sendStatus: http.StatusTooManyRequests}
	svc := newTestPushService(t, fake)

	results := svc.Send(context.Background(), []ExpoPushMessage{{To: []string{"a"}}, {To: []string{"b"}}})

	assert.Equal(t, []PushResult{{Token: "a", Error: PushErrorNotSent}, {Token: "b", Error: PushErrorNotSent}}, results)
	assert.Empty(t, InvalidTokens(results), "a refused request says nothing about the devices")
}

func TestSend_AMissingTicketIsAFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"data":[{"status":"ok","id":"only-one"}]}`)
	}))
	defer srv.Close()
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	svc := NewExpoPushService(logger)
	svc.baseURL = srv.URL

	results := svc.Send(context.Background(), []ExpoPushMessage{{To: []string{"a"}}, {To: []string{"b"}}})

	assert.Equal(t, []PushResult{{Token: "a", TicketID: "only-one"}, {Token: "b", Error: PushErrorNotSent}}, results)
}

func TestGetReceipts(t *testing.T) {
	gone := ExpoPushReceipt{Status: "error", Message: "not registered"}
	gone.Details.Error = PushErrorDeviceNotRegistered
	fake := &fakeExpo{receipts: map[string]ExpoPushReceipt{
		"t1": {Status: "ok"},
		"t2": gone,
	}}
	svc := newTestPushService(t, fake)

	receipts, err := svc.GetReceipts(context.Background(), []string{"t1", "t2", "t3"})

	require.NoError(t, err)
	require.Len(t, fake.receiptCalls, 1)
	assert.Equal(t, []string{"t1", "t2", "t3"}, fake.receiptCalls[0])
	assert.Equal(t, "ok", receipts["t1"].Status)
	assert.Equal(t, PushErrorDeviceNotRegistered, receipts["t2"].Details.Error)
	_, known := receipts["t3"]
	assert.False(t, known, "a ticket without receipt is absent, not an error")
}

func TestGetReceipts_AThousandIDsPerRequest(t *testing.T) {
	fake := &fakeExpo{}
	svc := newTestPushService(t, fake)

	ids := make([]string, 2001)
	for i := range ids {
		ids[i] = fmt.Sprintf("t-%d", i)
	}
	_, err := svc.GetReceipts(context.Background(), ids)

	require.NoError(t, err)
	require.Len(t, fake.receiptCalls, 3)
	assert.Len(t, fake.receiptCalls[0], 1000)
	assert.Len(t, fake.receiptCalls[1], 1000)
	assert.Len(t, fake.receiptCalls[2], 1)
}

func TestGetReceipts_ReportsAFailedRequest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	svc := NewExpoPushService(logger)
	svc.baseURL = srv.URL

	_, err := svc.GetReceipts(context.Background(), []string{"t1"})

	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "502"))
}

type captureRecorder struct {
	mu      sync.Mutex
	records []PushRecord
	panics  bool
}

func (r *captureRecorder) RecordPush(_ context.Context, record PushRecord) {
	if r.panics {
		panic("history is down")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.records = append(r.records, record)
}

func TestRecord_NeverCostsTheSend(t *testing.T) {
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	results := []PushResult{{Token: "a", TicketID: "t"}}

	var none *ExpoPushService
	none.Record(context.Background(), PushRecord{Results: results})

	svc := NewExpoPushService(logger)
	svc.Record(context.Background(), PushRecord{Results: results})

	svc.SetRecorder(&captureRecorder{panics: true})
	svc.Record(context.Background(), PushRecord{Results: results})

	rec := &captureRecorder{}
	svc.SetRecorder(rec)
	svc.Record(context.Background(), PushRecord{Kind: PushKindManual})
	assert.Empty(t, rec.records, "a send that reached no device leaves no entry")
	svc.Record(context.Background(), PushRecord{Kind: PushKindManual, Results: results})
	assert.Len(t, rec.records, 1)
}
