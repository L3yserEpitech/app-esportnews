package backoffice

import (
	"context"
	"strconv"
	"time"
)

// Keys of bo_setting. A key absent from the table reads as its default.
const (
	SettingNotifyNewArticle = "push.notify_new_article_default" // bool, default true
	SettingMatchLiveAlert   = "push.match_live_alert_enabled"   // bool, default true
)

func (m *Module) setting(ctx context.Context, key, def string) string {
	var value *string
	if err := m.db.WithContext(ctx).Raw("SELECT value FROM bo_setting WHERE key = ?", key).Scan(&value).Error; err != nil || value == nil {
		return def
	}
	return *value
}

func (m *Module) settingBool(ctx context.Context, key string, def bool) bool {
	b, err := strconv.ParseBool(m.setting(ctx, key, strconv.FormatBool(def)))
	if err != nil {
		return def
	}
	return b
}

func (m *Module) settingTime(ctx context.Context, key string) *time.Time {
	t, err := time.Parse(time.RFC3339, m.setting(ctx, key, ""))
	if err != nil {
		return nil
	}
	return &t
}

func (m *Module) setSetting(ctx context.Context, key, value string) error {
	return m.db.WithContext(ctx).Exec(
		`INSERT INTO bo_setting (key, value, updated_at) VALUES (?, ?, now())
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, key, value).Error
}
