package backoffice

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/services"
)

const (
	// Expo: « We recommend checking push receipts 15 minutes after sending ».
	receiptDelay = 15 * time.Minute
	// Expo clears receipts after 24 hours: an older ticket will never get one.
	receiptLifetime = 24 * time.Hour
	// How long a send whose receipts are not all in waits before the next try.
	receiptRetryEvery  = 30 * time.Minute
	receiptJobInterval = 2 * time.Minute
	// One page of tickets is one getReceipts call (1000 ids at most).
	receiptPageSize         = 1000
	maxLogsPerReceiptRun    = 50
	maxTicketsPerReceiptRun = 20000
	ticketInsertBatch       = 500
)

// RecordPush implements services.PushRecorder. It returns at once: the sender
// (scheduler tick, publication) never waits for the history.
func (m *Module) RecordPush(_ context.Context, record services.PushRecord) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				m.log.Errorf("[BO] push history panicked: %v", r)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if _, err := m.recordPush(ctx, record); err != nil {
			m.log.WithError(err).WithField("kind", record.Kind).Error("[BO] push history entry lost")
		}
	}()
}

// recordPush writes the history entry of a send and keeps its Expo tickets
// until their receipts are read.
func (m *Module) recordPush(ctx context.Context, record services.PushRecord) (int64, error) {
	var failed, gone int
	tickets := make([]map[string]interface{}, 0, len(record.Results))
	for _, r := range record.Results {
		if r.OK() {
			tickets = append(tickets, map[string]interface{}{"ticket_id": r.TicketID, "token": r.Token})
			continue
		}
		failed++
		if r.Error == services.PushErrorDeviceNotRegistered {
			gone++
		}
	}

	var actor interface{}
	if record.ActorID != 0 {
		actor = record.ActorID
	}
	// Nothing to wait for when Expo refused everything.
	var checkedAt interface{}
	if len(tickets) == 0 {
		checkedAt = time.Now()
	}

	var id int64
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Raw(
			`INSERT INTO bo_push_log (kind, title, body, audience, ref, actor_id, sent, failed, deactivated, receipts_checked_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
			record.Kind, clip(record.Title, 300), clip(record.Body, 500), record.Audience, record.Ref, actor,
			len(record.Results), failed, gone, checkedAt,
		).Scan(&id).Error; err != nil {
			return err
		}
		for i := 0; i < len(tickets); i += ticketInsertBatch {
			end := i + ticketInsertBatch
			if end > len(tickets) {
				end = len(tickets)
			}
			batch := tickets[i:end]
			for _, t := range batch {
				t["push_log_id"] = id
			}
			if err := tx.Table("bo_push_ticket").Create(batch).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return id, err
}

func (m *Module) startPushJobs(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(receiptJobInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				m.checkPushReceipts(ctx)
			}
		}
	}()
}

type pendingTicket struct {
	ID       int64
	TicketID string
	Token    string
}

// checkPushReceipts reads what Apple and Google answered for the sends old
// enough to have receipts. Deleting a ticket is what claims it: a second run,
// or a second instance, can never count the same receipt twice.
func (m *Module) checkPushReceipts(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			m.log.Errorf("[BO] push receipts job panicked: %v", r)
		}
	}()
	now := time.Now()
	db := m.db.WithContext(ctx)

	if err := db.Exec("DELETE FROM bo_push_ticket WHERE created_at < ?", now.Add(-receiptLifetime)).Error; err != nil {
		m.log.WithError(err).Warn("[BO] expired push tickets not dropped")
		return
	}

	type dueLog struct {
		ID        int64
		CreatedAt time.Time
	}
	var due []dueLog
	if err := db.Raw(
		`SELECT l.id, l.created_at FROM bo_push_log l
		 WHERE l.created_at < ?
		   AND (l.receipts_checked_at IS NULL OR l.receipts_checked_at < ?)
		   AND EXISTS (SELECT 1 FROM bo_push_ticket t WHERE t.push_log_id = l.id)
		 ORDER BY l.id LIMIT ?`,
		now.Add(-receiptDelay), now.Add(-receiptRetryEvery), maxLogsPerReceiptRun).Scan(&due).Error; err != nil {
		m.log.WithError(err).Warn("[BO] push receipts: could not list the sends to check")
		return
	}

	budget := maxTicketsPerReceiptRun
	for _, l := range due {
		if budget <= 0 || ctx.Err() != nil {
			return
		}
		done, used, err := m.checkLogReceipts(ctx, l.ID, l.CreatedAt, budget)
		budget -= used
		if err != nil {
			// Expo or the database is unwell: the next run starts again here.
			m.log.WithError(err).WithField("push_log_id", l.ID).Warn("[BO] push receipts not read")
			return
		}
		if done {
			if err := db.Exec("UPDATE bo_push_log SET receipts_checked_at = now() WHERE id = ?", l.ID).Error; err != nil {
				m.log.WithError(err).Warn("[BO] push receipts: check not stamped")
			}
		}
	}
}

// checkLogReceipts goes once through the tickets of a send. done is false when
// the budget ran out first.
func (m *Module) checkLogReceipts(ctx context.Context, logID int64, sentAt time.Time, budget int) (done bool, used int, err error) {
	db := m.db.WithContext(ctx)
	var cursor int64
	for {
		if used >= budget {
			return false, used, nil
		}
		var page []pendingTicket
		if err := db.Raw(
			"SELECT id, ticket_id, token FROM bo_push_ticket WHERE push_log_id = ? AND id > ? ORDER BY id LIMIT ?",
			logID, cursor, receiptPageSize).Scan(&page).Error; err != nil {
			return false, used, err
		}
		if len(page) == 0 {
			return true, used, nil
		}
		cursor = page[len(page)-1].ID
		used += len(page)

		ids := make([]string, len(page))
		for i, t := range page {
			ids[i] = t.TicketID
		}
		receipts, err := m.push.GetReceipts(ctx, ids)
		if err != nil {
			return false, used, err
		}
		if err := m.applyReceipts(ctx, logID, sentAt, page, receipts); err != nil {
			return false, used, err
		}
	}
}

func (m *Module) applyReceipts(ctx context.Context, logID int64, sentAt time.Time, page []pendingTicket, receipts map[string]services.ExpoPushReceipt) error {
	byID := make(map[int64]pendingTicket, len(page))
	var answered []int64
	for _, t := range page {
		// No receipt yet: the ticket stays for a later run.
		if _, ok := receipts[t.TicketID]; ok {
			byID[t.ID] = t
			answered = append(answered, t.ID)
		}
	}
	if len(answered) == 0 {
		return nil
	}

	return m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var claimed []int64
		if err := tx.Raw("DELETE FROM bo_push_ticket WHERE id IN ? RETURNING id", answered).Scan(&claimed).Error; err != nil {
			return err
		}
		var delivered, failed int
		var gone []string
		for _, id := range claimed {
			t := byID[id]
			receipt := receipts[t.TicketID]
			if receipt.Status == "ok" {
				delivered++
				continue
			}
			failed++
			if receipt.Details.Error == services.PushErrorDeviceNotRegistered && t.Token != "" {
				gone = append(gone, t.Token)
			}
			m.log.Warnf("[BO] push receipt error: %s - %s", receipt.Details.Error, receipt.Message)
		}

		var deactivated int64
		if len(gone) > 0 {
			// A token registered again since the send belongs to a device that came back.
			res := tx.Exec(
				"UPDATE push_token SET active = false, updated_at = now() WHERE token IN ? AND active = true AND updated_at < ?",
				gone, sentAt)
			if res.Error != nil {
				return res.Error
			}
			deactivated = res.RowsAffected
		}
		return tx.Exec(
			"UPDATE bo_push_log SET delivered = delivered + ?, failed = failed + ?, deactivated = deactivated + ? WHERE id = ?",
			delivered, failed, deactivated, logID).Error
	})
}
