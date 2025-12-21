package utils

import (
	"testing"
)

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		name     string
		title    string
		maxChars int
		maxWords int
		expected string
	}{
		{
			name:     "Simple title",
			title:    "League of Legends World Championship",
			maxChars: 150,
			maxWords: 0,
			expected: "league-of-legends-world-championship",
		},
		{
			name:     "Title with accents",
			title:    "Équipe française remporte le tournoi européen",
			maxChars: 150,
			maxWords: 0,
			expected: "equipe-francaise-remporte-le-tournoi-europeen",
		},
		{
			name:     "Very long title with maxChars limit",
			title:    "League of Legends World Championship 2025 Grand Final Results and Complete Analysis of the Tournament",
			maxChars: 60,
			maxWords: 0,
			expected: "league-of-legends-world-championship-2025-grand-final",
		},
		{
			name:     "Title with special characters",
			title:    "CS:GO Major - Team Vitality vs. G2 Esports (Best of 5)",
			maxChars: 150,
			maxWords: 0,
			expected: "csgo-major-team-vitality-vs-g2-esports-best-of-5",
		},
		{
			name:     "Title with maxWords limit",
			title:    "One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve",
			maxChars: 150,
			maxWords: 5,
			expected: "one-two-three-four-five",
		},
		{
			name:     "Title with both limits",
			title:    "Very Long Title With Many Words That Should Be Truncated Properly",
			maxChars: 30,
			maxWords: 10,
			expected: "very-long-title-with-many",
		},
		{
			name:     "Title with numbers",
			title:    "Top 10 Players 2025 - Valorant Rankings",
			maxChars: 150,
			maxWords: 0,
			expected: "top-10-players-2025-valorant-rankings",
		},
		{
			name:     "Title with multiple spaces and hyphens",
			title:    "Team   Liquid  -  Champions   Again!",
			maxChars: 150,
			maxWords: 0,
			expected: "team-liquid-champions-again",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateSlug(tt.title, tt.maxChars, tt.maxWords)
			if result != tt.expected {
				t.Errorf("GenerateSlug() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGenerateSlug_PreservesContext(t *testing.T) {
	// Two similar titles should generate different slugs when they differ
	title1 := "League of Legends World Championship 2025 Grand Final Results"
	title2 := "League of Legends World Championship 2025 Grand Final Preview"

	slug1 := GenerateSlug(title1, 150, 0)
	slug2 := GenerateSlug(title2, 150, 0)

	if slug1 == slug2 {
		t.Errorf("Different titles generated same slug:\n  Title 1: %s\n  Title 2: %s\n  Slug: %s",
			title1, title2, slug1)
	}

	// Expected slugs
	expectedSlug1 := "league-of-legends-world-championship-2025-grand-final-results"
	expectedSlug2 := "league-of-legends-world-championship-2025-grand-final-preview"

	if slug1 != expectedSlug1 {
		t.Errorf("Title 1 slug = %v, want %v", slug1, expectedSlug1)
	}

	if slug2 != expectedSlug2 {
		t.Errorf("Title 2 slug = %v, want %v", slug2, expectedSlug2)
	}
}

func TestGenerateSlug_WordBoundary(t *testing.T) {
	// When truncating at maxChars, should cut at word boundary
	title := "This is a very long title that needs to be truncated properly"
	slug := GenerateSlug(title, 30, 0)

	// Should cut at word boundary (last complete word before char 30)
	// "this-is-a-very-long-title" = 25 chars
	expected := "this-is-a-very-long-title"

	if slug != expected {
		t.Errorf("GenerateSlug() with word boundary = %v (len=%d), want %v (len=%d)",
			slug, len(slug), expected, len(expected))
	}

	// Verify no trailing hyphens
	if slug[len(slug)-1] == '-' {
		t.Errorf("Slug should not end with hyphen: %v", slug)
	}
}

func TestGenerateUniqueSlug(t *testing.T) {
	// Mock database check function
	existingSlugs := make(map[string]bool)

	checkExists := func(slug string) (bool, error) {
		return existingSlugs[slug], nil
	}

	// Test 1: Slug doesn't exist, should return base slug
	title := "Test Article Title"
	slug, err := GenerateUniqueSlug(title, 150, checkExists)
	if err != nil {
		t.Fatalf("GenerateUniqueSlug() error = %v", err)
	}
	if slug != "test-article-title" {
		t.Errorf("GenerateUniqueSlug() = %v, want %v", slug, "test-article-title")
	}

	// Test 2: Base slug exists, should append -2
	existingSlugs["test-article-title"] = true
	slug, err = GenerateUniqueSlug(title, 150, checkExists)
	if err != nil {
		t.Fatalf("GenerateUniqueSlug() error = %v", err)
	}
	if slug != "test-article-title-2" {
		t.Errorf("GenerateUniqueSlug() = %v, want %v", slug, "test-article-title-2")
	}

	// Test 3: Multiple slugs exist, should find first available
	existingSlugs["test-article-title-2"] = true
	existingSlugs["test-article-title-3"] = true
	slug, err = GenerateUniqueSlug(title, 150, checkExists)
	if err != nil {
		t.Fatalf("GenerateUniqueSlug() error = %v", err)
	}
	if slug != "test-article-title-4" {
		t.Errorf("GenerateUniqueSlug() = %v, want %v", slug, "test-article-title-4")
	}
}

func TestGenerateUniqueSlug_WithMaxChars(t *testing.T) {
	existingSlugs := make(map[string]bool)

	checkExists := func(slug string) (bool, error) {
		return existingSlugs[slug], nil
	}

	// Long title that will be truncated
	title := "This is a very long article title that needs to be truncated"

	// Base slug exists
	existingSlugs["this-is-a-very-long-article"] = true

	slug, err := GenerateUniqueSlug(title, 30, checkExists)
	if err != nil {
		t.Fatalf("GenerateUniqueSlug() error = %v", err)
	}

	// Should be truncated and have -2 suffix, staying under 30 chars
	if len(slug) > 30 {
		t.Errorf("Slug length %d exceeds maxChars 30: %v", len(slug), slug)
	}

	// Should end with -2
	if slug[len(slug)-2:] != "-2" {
		t.Errorf("Slug should end with -2: %v", slug)
	}
}

func TestCalculateReadTime(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected int
	}{
		{
			name:     "Short content (minimum 1 min)",
			content:  "This is a short article.",
			expected: 1,
		},
		{
			name:     "Exactly 200 words (1 min)",
			content:  generateWords(200),
			expected: 1,
		},
		{
			name:     "400 words (2 min)",
			content:  generateWords(400),
			expected: 2,
		},
		{
			name:     "Content with HTML tags",
			content:  "<p>This is a <strong>test</strong> article.</p>",
			expected: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateReadTime(tt.content)
			if result != tt.expected {
				t.Errorf("CalculateReadTime() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// Helper function to generate N words
func generateWords(n int) string {
	result := ""
	for i := 0; i < n; i++ {
		result += "word "
	}
	return result
}
