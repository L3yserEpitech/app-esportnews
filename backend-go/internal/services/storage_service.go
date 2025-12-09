package services

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

type StorageService struct {
	client    *s3.Client
	bucket    string
	publicURL string
	logger    *logrus.Logger
}

type UploadOptions struct {
	Path        string    // e.g., "articles/covers/images"
	Filename    string    // e.g., "my-article-2025.jpg"
	ContentType string    // e.g., "image/jpeg"
	Body        io.Reader // File content
	Size        int64     // File size in bytes
}

// NewStorageService creates a new storage service for Cloudflare R2
func NewStorageService(
	endpoint string,
	accessKeyID string,
	secretAccessKey string,
	bucketName string,
	publicURL string,
	logger *logrus.Logger,
) (*StorageService, error) {
	// Configure AWS SDK for R2 (S3-compatible)
	r2Resolver := aws.EndpointResolverWithOptionsFunc(
		func(service, region string, options ...interface{}) (aws.Endpoint, error) {
			return aws.Endpoint{
				URL:           endpoint,
				SigningRegion: "auto",
			}, nil
		},
	)

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithEndpointResolverWithOptions(r2Resolver),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				accessKeyID,
				secretAccessKey,
				"",
			),
		),
		config.WithRegion("auto"), // R2 uses "auto" region
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config for R2: %w", err)
	}

	client := s3.NewFromConfig(cfg)

	logger.Info("StorageService initialized successfully for Cloudflare R2")

	return &StorageService{
		client:    client,
		bucket:    bucketName,
		publicURL: publicURL,
		logger:    logger,
	}, nil
}

// Upload uploads a file to R2 and returns the public URL
func (s *StorageService) Upload(ctx context.Context, opts UploadOptions) (string, error) {
	// Generate full object key (path + filename)
	key := filepath.Join(opts.Path, opts.Filename)
	key = strings.ReplaceAll(key, "\\", "/") // Ensure Unix-style paths

	s.logger.Infof("Uploading file to R2: bucket=%s, key=%s, size=%d", s.bucket, key, opts.Size)

	// Upload to R2
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          opts.Body,
		ContentType:   aws.String(opts.ContentType),
		ContentLength: aws.Int64(opts.Size),
	})
	if err != nil {
		s.logger.Errorf("Failed to upload to R2: %v", err)
		return "", fmt.Errorf("failed to upload to R2: %w", err)
	}

	// Generate public URL
	publicURL := fmt.Sprintf("%s/%s", strings.TrimSuffix(s.publicURL, "/"), key)
	s.logger.Infof("File uploaded successfully: %s", publicURL)

	return publicURL, nil
}

// Delete deletes a file from R2 by its public URL
func (s *StorageService) Delete(ctx context.Context, url string) error {
	// Extract key from public URL
	key := strings.TrimPrefix(url, s.publicURL+"/")
	key = strings.TrimPrefix(key, s.publicURL)
	key = strings.TrimPrefix(key, "/")

	if key == "" {
		return fmt.Errorf("invalid URL: cannot extract key")
	}

	s.logger.Infof("Deleting file from R2: bucket=%s, key=%s", s.bucket, key)

	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		s.logger.Errorf("Failed to delete from R2: %v", err)
		return fmt.Errorf("failed to delete from R2: %w", err)
	}

	s.logger.Infof("File deleted successfully: %s", key)
	return nil
}

// GenerateFilename creates a unique filename with timestamp and UUID
func GenerateFilename(originalName string) string {
	ext := filepath.Ext(originalName)
	timestamp := time.Now().Unix()
	uid := uuid.New().String()[:8]
	return fmt.Sprintf("%d-%s%s", timestamp, uid, ext)
}

// GenerateSlugFilename creates a filename based on slug with timestamp
func GenerateSlugFilename(slug string, ext string) string {
	timestamp := time.Now().Unix()
	uid := uuid.New().String()[:8]

	// Clean slug for filename
	cleanSlug := strings.ToLower(slug)
	cleanSlug = strings.ReplaceAll(cleanSlug, " ", "-")

	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}

	return fmt.Sprintf("%s-%d-%s%s", cleanSlug, timestamp, uid, ext)
}
