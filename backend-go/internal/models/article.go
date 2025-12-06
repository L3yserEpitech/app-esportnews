package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// StringArray is a PostgreSQL text array type
type StringArray []string

type Article struct {
	ID             int64          `json:"id" gorm:"primaryKey"`
	CreatedAt      time.Time      `json:"created_at" gorm:"autoCreateTime:milli"`
	Slug           *string        `json:"slug" gorm:"uniqueIndex"`
	Tags           StringArray    `json:"tags" gorm:"type:text[]"`
	Title          *string        `json:"title"`
	Views          int32          `json:"views" gorm:"default:0"`
	Author         *string        `json:"author"`
	Content        *string        `json:"content"`
	Category       *string        `json:"category"`
	Subtitle       *string        `json:"subtitle"`
	Description    *string        `json:"description"`
	ContentBlack   *string        `json:"content_black"`
	ContentWhite   *string        `json:"content_white"`
	FeaturedImage  *string        `json:"featuredImage" gorm:"column:featuredImage"`
	VideoURL       *string        `json:"videoUrl" gorm:"column:videoUrl"`
	VideoType      *string        `json:"videoType" gorm:"column:videoType"`
	Credit         *string        `json:"credit"`
}

// TableName specifies the table name for Article
func (Article) TableName() string {
	return "articles"
}

func (a StringArray) MarshalJSON() ([]byte, error) {
	return json.Marshal([]string(a))
}

func (a *StringArray) UnmarshalJSON(data []byte) error {
	var arr []string
	if err := json.Unmarshal(data, &arr); err != nil {
		return err
	}
	*a = StringArray(arr)
	return nil
}

func (a StringArray) Value() (driver.Value, error) {
	if len(a) == 0 {
		return "{}", nil
	}
	// PostgreSQL array format: {"value1","value2","value3"}
	var escapedValues []string
	for _, v := range a {
		// Escape quotes and backslashes
		escaped := strings.ReplaceAll(v, `\`, `\\`)
		escaped = strings.ReplaceAll(escaped, `"`, `\"`)
		escapedValues = append(escapedValues, `"`+escaped+`"`)
	}
	return "{" + strings.Join(escapedValues, ",") + "}", nil
}

func (a *StringArray) Scan(value interface{}) error {
	if value == nil {
		*a = StringArray{}
		return nil
	}

	switch v := value.(type) {
	case []byte:
		str := string(v)
		if len(str) > 0 && str[0] == '{' {
			// PostgreSQL array format: {value1,value2,value3}
			return a.parsePostgresArray(str)
		}
		// Try JSON format
		return json.Unmarshal(v, &a)
	case string:
		if len(v) > 0 && v[0] == '{' {
			// PostgreSQL array format
			return a.parsePostgresArray(v)
		}
		// Try JSON format
		return json.Unmarshal([]byte(v), &a)
	case []interface{}:
		*a = make(StringArray, len(v))
		for i, item := range v {
			if str, ok := item.(string); ok {
				(*a)[i] = str
			}
		}
		return nil
	default:
		return errors.New("cannot scan type " + fmt.Sprintf("%T", value) + " into StringArray")
	}
}

func (a *StringArray) parsePostgresArray(str string) error {
	// Parse PostgreSQL array format: {value1,value2,value3}
	if len(str) < 2 || str[0] != '{' || str[len(str)-1] != '}' {
		return errors.New("invalid PostgreSQL array format")
	}

	// Remove braces
	inner := str[1 : len(str)-1]
	if inner == "" {
		*a = StringArray{}
		return nil
	}

	// Split by comma (simple version - doesn't handle quoted commas)
	parts := strings.Split(inner, ",")
	result := make(StringArray, 0, len(parts))

	for _, part := range parts {
		part = strings.TrimSpace(part)
		// Remove quotes if present
		if len(part) >= 2 && part[0] == '"' && part[len(part)-1] == '"' {
			part = part[1 : len(part)-1]
			// Unescape quotes and backslashes
			part = strings.ReplaceAll(part, `\"`, `"`)
			part = strings.ReplaceAll(part, `\\`, `\`)
		}
		if part != "NULL" && part != "" {
			result = append(result, part)
		}
	}

	*a = result
	return nil
}

type ArticleWithMetadata struct {
	*Article
	Similar []*Article `json:"similar"`
}
