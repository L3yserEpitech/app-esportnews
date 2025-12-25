package utils

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
)

// AllowedFileTypes définit les types de fichiers autorisés avec leurs magic bytes
var AllowedFileTypes = map[string][]byte{
	".jpg":  {0xFF, 0xD8, 0xFF},           // JPEG
	".jpeg": {0xFF, 0xD8, 0xFF},           // JPEG
	".png":  {0x89, 0x50, 0x4E, 0x47},     // PNG
	".webp": {0x52, 0x49, 0x46, 0x46},     // WEBP (RIFF header)
	".gif":  {0x47, 0x49, 0x46, 0x38},     // GIF
	".mp4":  {0x00, 0x00, 0x00},           // MP4 (ftyp box)
}

const MaxFileSize = 10 * 1024 * 1024 // 10 MB

type FileValidationError struct {
	Message string
}

func (e *FileValidationError) Error() string {
	return e.Message
}

// ValidateUploadedFile vérifie l'extension, la taille et les magic bytes d'un fichier uploadé
func ValidateUploadedFile(file *multipart.FileHeader) error {
	// 1. Vérifier la taille
	if file.Size > MaxFileSize {
		return &FileValidationError{
			Message: fmt.Sprintf("File size exceeds maximum allowed size of %d MB", MaxFileSize/(1024*1024)),
		}
	}

	// 2. Vérifier l'extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedMagicBytes, isAllowed := AllowedFileTypes[ext]
	if !isAllowed {
		return &FileValidationError{
			Message: fmt.Sprintf("File type %s not allowed. Allowed types: .jpg, .jpeg, .png, .webp, .gif, .mp4", ext),
		}
	}

	// 3. Vérifier les magic bytes (signature du fichier)
	src, err := file.Open()
	if err != nil {
		return &FileValidationError{Message: "Failed to open file for validation"}
	}
	defer src.Close()

	// Lire les premiers octets pour vérifier la signature
	magicBytes := make([]byte, len(allowedMagicBytes))
	_, err = io.ReadFull(src, magicBytes)
	if err != nil {
		return &FileValidationError{Message: "Failed to read file signature"}
	}

	// Comparer les magic bytes
	if !bytes.Equal(magicBytes, allowedMagicBytes) {
		return &FileValidationError{
			Message: fmt.Sprintf("File signature does not match extension %s. Possible file type mismatch or malicious file.", ext),
		}
	}

	return nil
}

// SanitizeFilename nettoie le nom de fichier pour éviter path traversal
func SanitizeFilename(filename string) string {
	// Supprimer les caractères dangereux
	filename = strings.ReplaceAll(filename, "..", "")
	filename = strings.ReplaceAll(filename, "/", "")
	filename = strings.ReplaceAll(filename, "\\", "")
	filename = strings.ReplaceAll(filename, " ", "_")

	// Limiter la longueur
	if len(filename) > 255 {
		ext := filepath.Ext(filename)
		name := filename[:255-len(ext)]
		filename = name + ext
	}

	return filename
}
