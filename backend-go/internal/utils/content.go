package utils

import (
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"golang.org/x/net/html"
)

// GenerateSlug creates a URL-friendly slug from a title
// maxChars: maximum length of the slug (default: 150 to preserve more context)
// maxWords: maximum number of words (0 = no limit, preserves all important words)
func GenerateSlug(title string, maxChars, maxWords int) string {
	// Convert to lowercase
	slug := strings.ToLower(title)

	// Remove accents and special characters
	slug = removeAccents(slug)

	// Replace non-alphanumeric characters with hyphens
	reg := regexp.MustCompile("[^a-z0-9]+")
	slug = reg.ReplaceAllString(slug, "-")

	// Remove leading and trailing hyphens
	slug = strings.Trim(slug, "-")

	// Limit to maxWords only if specified and > 0
	if maxWords > 0 {
		words := strings.Split(slug, "-")
		if len(words) > maxWords {
			// Keep first maxWords words to preserve context
			words = words[:maxWords]
			slug = strings.Join(words, "-")
		}
	}

	// Limit to maxChars, but cut at word boundary to avoid mid-word cuts
	if maxChars > 0 && len(slug) > maxChars {
		// Find the last complete word before maxChars
		truncated := slug[:maxChars]
		lastHyphen := strings.LastIndex(truncated, "-")

		if lastHyphen > 0 {
			// Cut at last word boundary
			slug = truncated[:lastHyphen]
		} else {
			// No word boundary found, keep truncated version
			slug = truncated
		}

		// Remove trailing hyphen
		slug = strings.TrimRight(slug, "-")
	}

	return slug
}

// GenerateUniqueSlug creates a unique slug by appending a numeric suffix if needed
// checkExists is a callback function that checks if a slug already exists in the database
func GenerateUniqueSlug(title string, maxChars int, checkExists func(slug string) (bool, error)) (string, error) {
	// Generate base slug (no word limit to preserve maximum context)
	baseSlug := GenerateSlug(title, maxChars, 0)

	// Check if base slug is available
	exists, err := checkExists(baseSlug)
	if err != nil {
		return "", err
	}

	if !exists {
		return baseSlug, nil
	}

	// Base slug exists, try with numeric suffixes
	for i := 2; i <= 999; i++ {
		candidateSlug := fmt.Sprintf("%s-%d", baseSlug, i)

		// If adding suffix exceeds maxChars, truncate base slug
		if maxChars > 0 && len(candidateSlug) > maxChars {
			suffixLen := len(fmt.Sprintf("-%d", i))
			baseSlugTruncated := baseSlug[:maxChars-suffixLen]
			// Remove trailing hyphen if present
			baseSlugTruncated = strings.TrimRight(baseSlugTruncated, "-")
			candidateSlug = fmt.Sprintf("%s-%d", baseSlugTruncated, i)
		}

		exists, err := checkExists(candidateSlug)
		if err != nil {
			return "", err
		}

		if !exists {
			return candidateSlug, nil
		}
	}

	// Fallback: use timestamp-based suffix if all numeric suffixes exhausted
	timestamp := time.Now().Unix()
	return fmt.Sprintf("%s-%d", baseSlug[:maxChars-15], timestamp), nil
}

// CalculateReadTime calculates reading time in minutes based on word count
// Assumes average reading speed of 200 words per minute
func CalculateReadTime(content string) int {
	// Strip HTML tags
	text := stripHTML(content)

	// Count words
	words := strings.Fields(text)
	wordCount := len(words)

	// Calculate minutes (minimum 1 minute)
	minutes := wordCount / 200
	if minutes < 1 {
		minutes = 1
	}

	return minutes
}

// CleanHTML removes potentially dangerous HTML elements and attributes
func CleanHTML(htmlContent string) string {
	// For now, just return the content as-is
	// In production, you might want to use a library like bluemonday
	return htmlContent
}

// GenerateContentWhite adds inline styles for white text (dark background)
func GenerateContentWhite(htmlContent string) string {
	return addInlineStyles(htmlContent, "#ffffff", "#e5e7eb") // White text, light gray for secondary
}

// GenerateContentBlack adds inline styles for black text (light background)
func GenerateContentBlack(htmlContent string) string {
	return addInlineStyles(htmlContent, "#000000", "#1f2937") // Black text, dark gray for secondary
}

// addInlineStyles parses HTML and adds color styles to text elements
func addInlineStyles(htmlContent string, primaryColor string, secondaryColor string) string {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		// If parsing fails, return original content
		return htmlContent
	}

	// Traverse and add styles
	var f func(*html.Node)
	f = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "li", "td", "th":
				// Add or append to existing style attribute
				addStyleAttribute(n, "color", primaryColor)
			case "a":
				// Links get primary color with underline
				addStyleAttribute(n, "color", primaryColor)
				addStyleAttribute(n, "text-decoration", "underline")
			case "blockquote":
				// Blockquotes get secondary color
				addStyleAttribute(n, "color", secondaryColor)
				addStyleAttribute(n, "border-left", "4px solid "+primaryColor)
				addStyleAttribute(n, "padding-left", "1rem")
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			f(c)
		}
	}
	f(doc)

	// Render back to HTML
	var buf strings.Builder
	html.Render(&buf, doc)
	result := buf.String()

	// Remove <html><head></head><body> and </body></html> tags added by parser
	result = strings.TrimPrefix(result, "<html><head></head><body>")
	result = strings.TrimSuffix(result, "</body></html>")

	return result
}

// addStyleAttribute adds or updates a CSS property in the style attribute
func addStyleAttribute(n *html.Node, property, value string) {
	var styleAttr *html.Attribute
	for i, attr := range n.Attr {
		if attr.Key == "style" {
			styleAttr = &n.Attr[i]
			break
		}
	}

	newStyle := property + ": " + value + ";"

	if styleAttr == nil {
		// No existing style attribute, add new one
		n.Attr = append(n.Attr, html.Attribute{
			Key: "style",
			Val: newStyle,
		})
	} else {
		// Append to existing style
		if !strings.HasSuffix(styleAttr.Val, ";") {
			styleAttr.Val += ";"
		}
		styleAttr.Val += " " + newStyle
	}
}

// stripHTML removes all HTML tags from content
func stripHTML(htmlContent string) string {
	// Remove HTML tags
	reg := regexp.MustCompile("<[^>]*>")
	text := reg.ReplaceAllString(htmlContent, " ")

	// Remove extra whitespace
	text = strings.Join(strings.Fields(text), " ")

	return text
}

// removeAccents removes accents from characters
func removeAccents(s string) string {
	// Common accent replacements
	replacements := map[rune]string{
		'à': "a", 'á': "a", 'â': "a", 'ã': "a", 'ä': "a", 'å': "a",
		'è': "e", 'é': "e", 'ê': "e", 'ë': "e",
		'ì': "i", 'í': "i", 'î': "i", 'ï': "i",
		'ò': "o", 'ó': "o", 'ô': "o", 'õ': "o", 'ö': "o",
		'ù': "u", 'ú': "u", 'û': "u", 'ü': "u",
		'ý': "y", 'ÿ': "y",
		'ñ': "n",
		'ç': "c",
		'À': "A", 'Á': "A", 'Â': "A", 'Ã': "A", 'Ä': "A", 'Å': "A",
		'È': "E", 'É': "E", 'Ê': "E", 'Ë': "E",
		'Ì': "I", 'Í': "I", 'Î': "I", 'Ï': "I",
		'Ò': "O", 'Ó': "O", 'Ô': "O", 'Õ': "O", 'Ö': "O",
		'Ù': "U", 'Ú': "U", 'Û': "U", 'Ü': "U",
		'Ý': "Y",
		'Ñ': "N",
		'Ç': "C",
	}

	var result strings.Builder
	for _, char := range s {
		if replacement, ok := replacements[char]; ok {
			result.WriteString(replacement)
		} else if unicode.IsLetter(char) || unicode.IsDigit(char) || unicode.IsSpace(char) {
			result.WriteRune(char)
		}
	}

	return result.String()
}
