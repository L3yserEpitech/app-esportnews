package models

import "encoding/json"

// LiquipediaResponse is the generic API v3 response wrapper.
// The "result" field contains an array of raw JSON objects
// whose shape depends on the endpoint called.
type LiquipediaResponse struct {
	Result []json.RawMessage `json:"result"`
}

// LiquipediaWebhookEvent represents a webhook payload from LiquipediaDB.
// Events: "edit", "delete", "move", "purge".
// Namespace 0 = main content (matches, tournaments, players).
// Namespace -10 = teamtemplates (team logos/info).
type LiquipediaWebhookEvent struct {
	Page          string `json:"page"`
	FromPage      string `json:"from_page,omitempty"`
	Namespace     int    `json:"namespace"`
	FromNamespace int    `json:"from_namespace,omitempty"`
	Wiki          string `json:"wiki"`
	Event         string `json:"event"` // "edit", "delete", "move", "purge"
}

// GameWikiMapping maps internal game acronyms to Liquipedia wiki names.
var GameWikiMapping = map[string]string{
	"csgo":     "counterstrike",
	"valorant": "valorant",
	"lol":      "leagueoflegends",
	"dota2":    "dota2",
	"rl":       "rocketleague",
	"codmw":    "callofduty",
	"r6siege":  "rainbowsix",
	"ow":       "overwatch",
	"fifa":     "easportsfc",
	"mlbb":     "mobilelegends",
}

// WikiToAcronym is the reverse mapping: Liquipedia wiki → internal acronym.
var WikiToAcronym = func() map[string]string {
	m := make(map[string]string, len(GameWikiMapping))
	for acronym, wiki := range GameWikiMapping {
		m[wiki] = acronym
	}
	return m
}()

// ResolveWiki maps any game identifier a client may send us to a wiki: an
// internal acronym (csgo), a videogame slug (cs2) or a raw wiki name.
// The mobile app stores match_subscription.game_acronym from videogame.slug,
// which differs from the acronym for counterstrike (cs2) and easportsfc.
func ResolveWiki(id string) (string, bool) {
	if wiki, ok := GameWikiMapping[id]; ok {
		return wiki, true
	}
	if _, ok := WikiToAcronym[id]; ok {
		return id, true
	}
	for wiki, slug := range videogameSlugMap {
		if slug == id {
			return wiki, true
		}
	}
	return "", false
}
