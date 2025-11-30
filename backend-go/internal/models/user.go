package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Int64Array is a PostgreSQL integer array type
type Int64Array []int64

type User struct {
	ID            int64         `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time     `json:"created_at" gorm:"autoCreateTime:milli"`
	Name          string        `json:"name"`
	Email         string        `json:"email" gorm:"uniqueIndex"`
	Password      string        `json:"-"` // Never expose password
	Avatar        *string       `json:"avatar"`
	Admin         bool          `json:"admin" gorm:"default:false"`
	Age           *int          `json:"age"`
	FavoriteTeams Int64Array    `json:"favorite_teams" gorm:"type:integer[]"`
	NotifiPush    *bool         `json:"notifi_push" gorm:"column:notifi_push"`
	NotifArticles *bool         `json:"notif_articles" gorm:"column:notif_articles"`
	NotifNews     *bool         `json:"notif_news" gorm:"column:notif_news"`
	NotifMatches  *bool         `json:"notif_matchs" gorm:"column:notif_matchs"`
}

func (a Int64Array) MarshalJSON() ([]byte, error) {
	return json.Marshal([]int64(a))
}

func (a *Int64Array) UnmarshalJSON(data []byte) error {
	var arr []int64
	if err := json.Unmarshal(data, &arr); err != nil {
		return err
	}
	*a = Int64Array(arr)
	return nil
}

func (a Int64Array) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *Int64Array) Scan(value interface{}) error {
	if value == nil {
		*a = Int64Array{}
		return nil
	}

	switch v := value.(type) {
	case []byte:
		// Handle byte array - could be PostgreSQL array format like {1,2,3} or JSON
		str := string(v)
		if len(str) > 0 && str[0] == '{' {
			// PostgreSQL array format: {1,2,3}
			return a.parsePostgresArray(str)
		}
		// Try JSON format
		return json.Unmarshal(v, &a)
	case string:
		// Handle string representation of array
		if len(v) > 0 && v[0] == '{' {
			// PostgreSQL array format: {1,2,3}
			return a.parsePostgresArray(v)
		}
		// Try JSON format
		return json.Unmarshal([]byte(v), &a)
	case []interface{}:
		// Handle direct slice type from database
		*a = make(Int64Array, len(v))
		for i, item := range v {
			switch vi := item.(type) {
			case int64:
				(*a)[i] = vi
			case int:
				(*a)[i] = int64(vi)
			case float64:
				(*a)[i] = int64(vi)
			}
		}
		return nil
	default:
		return errors.New("cannot scan type " + fmt.Sprintf("%T", value) + " into Int64Array")
	}
}

func (a *Int64Array) parsePostgresArray(str string) error {
	// Parse PostgreSQL array format: {1,2,3} or {NULL,2,3}
	if len(str) < 2 || str[0] != '{' || str[len(str)-1] != '}' {
		return errors.New("invalid PostgreSQL array format")
	}

	// Remove braces
	inner := str[1 : len(str)-1]
	if inner == "" {
		*a = Int64Array{}
		return nil
	}

	// Split by comma
	parts := strings.Split(inner, ",")
	result := make(Int64Array, 0, len(parts))

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "NULL" || part == "" {
			continue
		}

		num, err := strconv.ParseInt(part, 10, 64)
		if err != nil {
			return fmt.Errorf("failed to parse array element %q: %w", part, err)
		}
		result = append(result, num)
	}

	*a = result
	return nil
}

type CreateUserInput struct {
	Name     string `json:"name" validate:"required"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	Age      *int   `json:"age" validate:"omitempty,min=13,max=120"`
}

type LoginInput struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	User         *User  `json:"user"`
}

type UpdateUserInput struct {
	Name   *string `json:"name"`
	Email  *string `json:"email"`
	Avatar *string `json:"avatar"`
}

type NotificationPreferences struct {
	UserID        int64 `json:"user_id"`
	NotifiPush    bool  `json:"notifi_push"`
	NotifNews     bool  `json:"notif_news"`
	NotifArticles bool  `json:"notif_articles"`
	NotifMatches  bool  `json:"notif_matchs"`
}
