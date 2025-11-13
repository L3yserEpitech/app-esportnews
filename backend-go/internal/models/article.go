package models

import (
	"time"
)

type Article struct {
	ID             int64          `json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	Slug           string         `json:"slug"`
	Tags           []string       `json:"tags"`
	Title          string         `json:"title"`
	Views          int32          `json:"views"`
	Author         *string        `json:"author"`
	Content        *string        `json:"content"`
	Category       *string        `json:"category"`
	Subtitle       *string        `json:"subtitle"`
	Description    *string        `json:"description"`
	ContentBlack   *string        `json:"content_black"`
	ContentWhite   *string        `json:"content_white"`
	FeaturedImage  *string        `json:"featuredImage"`
	VideoURL       *string        `json:"videoUrl"`
	VideoType      *string        `json:"videoType"`
}

type ArticleWithMetadata struct {
	*Article
	Similar []*Article `json:"similar"`
}
