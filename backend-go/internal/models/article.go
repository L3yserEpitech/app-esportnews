package models

import (
	"time"
)

type Article struct {
	ID             int64          `json:"id" gorm:"primaryKey"`
	CreatedAt      time.Time      `json:"created_at" gorm:"autoCreateTime:milli"`
	Slug           *string        `json:"slug" gorm:"uniqueIndex"`
	Tags           []string       `json:"tags" gorm:"type:text[]"`
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

type ArticleWithMetadata struct {
	*Article
	Similar []*Article `json:"similar"`
}
