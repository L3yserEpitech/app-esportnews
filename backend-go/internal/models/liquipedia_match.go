package models

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// LiqMatch represents a match from the Liquipedia API v3 /match endpoint.
// Fields are mapped directly from the Liquipedia response.
type LiqMatch struct {
	PageID             int             `json:"pageid"`
	PageName           string          `json:"pagename"`
	Namespace          int             `json:"namespace"`
	ObjectName         string          `json:"objectname"`
	Match2ID           string          `json:"match2id"`
	Match2BracketID    string          `json:"match2bracketid"`
	Status             string          `json:"status"`
	Winner             string          `json:"winner"`
	Walkover           string          `json:"walkover"`
	ResultType         string          `json:"resulttype"`
	Finished           int             `json:"finished"` // 0 or 1 (Liquipedia returns int, not bool)
	Mode               string          `json:"mode"`
	Type               string          `json:"type"`
	Section            string          `json:"section"`
	Game               string          `json:"game"`
	Patch              string          `json:"patch"`
	BestOf             int             `json:"bestof"`
	Date               string          `json:"date"`
	DateExact          int             `json:"dateexact"` // 0 or 1 (Liquipedia returns int, not bool)
	Vod                string          `json:"vod"`
	Tournament         string          `json:"tournament"`
	Parent             string          `json:"parent"`
	TickerName         string          `json:"tickername"`
	ShortName          string          `json:"shortname"`
	Series             string          `json:"series"`
	Icon               string          `json:"icon"`
	IconURL            string          `json:"iconurl"`
	IconDark           string          `json:"icondark"`
	IconDarkURL        string          `json:"icondarkurl"`
	LiquipediaTier     string          `json:"liquipediatier"`
	LiquipediaTierType string          `json:"liquipediatiertype"`
	PublisherTier      string          `json:"publishertier"`

	// Nested JSON — pass-through to frontend
	Match2Opponents   json.RawMessage `json:"match2opponents"`
	Match2Games       json.RawMessage `json:"match2games"`
	Stream            json.RawMessage `json:"stream"`
	Links             json.RawMessage `json:"links"`
	ExtraData         json.RawMessage `json:"extradata"`
	Match2BracketData json.RawMessage `json:"match2bracketdata"`
}

// LiqOpponent represents a single opponent entry inside match2opponents.
// Used for server-side filtering (checking if 2 named opponents exist).
type LiqOpponent struct {
	Name          string          `json:"name"`
	Template      string          `json:"template"`
	Score         interface{}     `json:"score"`
	Status        string          `json:"status"`
	Type          string          `json:"type"`
	ID            string          `json:"id"`
	Icon          string          `json:"icon"`
	IconDark      string          `json:"icondark"`
	Match2Players json.RawMessage `json:"match2players"`
}

// HasTwoNamedOpponents returns true if the match has at least 2 opponents
// with non-empty, non-TBD names. Used for filtering incomplete matches.
func (m *LiqMatch) HasTwoNamedOpponents() bool {
	if m.Match2Opponents == nil {
		return false
	}

	var opponents []LiqOpponent
	if err := json.Unmarshal(m.Match2Opponents, &opponents); err != nil {
		return false
	}

	named := 0
	for _, opp := range opponents {
		if opp.Name != "" && opp.Name != "TBD" && opp.Type != "literal" {
			named++
		}
	}
	return named >= 2
}

// UniqueKey returns a deduplication key for this match.
func (m *LiqMatch) UniqueKey() string {
	return m.ObjectName
}

// ParsedDate parses the match date string into time.Time.
// Liquipedia format: "YYYY-MM-DD HH:MM:SS"
func (m *LiqMatch) ParsedDate() (time.Time, error) {
	return time.Parse("2006-01-02 15:04:05", m.Date)
}

// --- Normalized types matching PandaMatch frontend interface ---

// NormalizedMatch is the PandaMatch-shaped struct sent to the frontend.
// It matches the TypeScript PandaMatch interface exactly.
type NormalizedMatch struct {
	ID                  int                     `json:"id"`
	Name                string                  `json:"name"`
	Slug                *string                 `json:"slug"`
	Status              *string                 `json:"status"`
	BeginAt             *string                 `json:"begin_at"`
	EndAt               *string                 `json:"end_at"`
	ScheduledAt         *string                 `json:"scheduled_at"`
	OriginalScheduledAt *string                 `json:"original_scheduled_at"`
	MatchType           *string                 `json:"match_type"`
	NumberOfGames       *int                    `json:"number_of_games"`
	Tournament          *NormalizedTournament   `json:"tournament"`
	Opponents           []NormalizedOpponent    `json:"opponents"`
	Results             []NormalizedMatchResult `json:"results"`
	League              *NormalizedLeague       `json:"league"`
	Serie               interface{}             `json:"serie"`
	StreamsList         []NormalizedStream      `json:"streams_list"`
	Games               []NormalizedGameEntry   `json:"games"`
	WinnerID            *int                    `json:"winner_id"`
	Winner              interface{}             `json:"winner"`
	Rescheduled         bool                    `json:"rescheduled"`
	Live                *NormalizedLive         `json:"live"`
	Videogame           *NormalizedVideogame    `json:"videogame"`

	// Extra Liquipedia fields for match detail navigation
	Match2ID string `json:"match2id,omitempty"`
	Wiki     string `json:"wiki,omitempty"`
}

// NormalizedOpponent matches the frontend PandaOpponent interface.
type NormalizedOpponent struct {
	ID       int                    `json:"id"`
	Type     string                 `json:"type"`
	Opponent *NormalizedTeamCompact `json:"opponent"`
}

// NormalizedMatchResult matches the frontend PandaMatchResult interface.
type NormalizedMatchResult struct {
	TeamID int `json:"team_id"`
	Score  int `json:"score"`
}

// NormalizedStream matches the frontend PandaStream interface.
type NormalizedStream struct {
	Main     bool   `json:"main"`
	Language string `json:"language"`
	EmbedURL string `json:"embed_url"`
	Official bool   `json:"official"`
	RawURL   string `json:"raw_url"`
}

// NormalizedGameEntry matches the frontend PandaGame interface.
type NormalizedGameEntry struct {
	Complete      bool            `json:"complete"`
	ID            int             `json:"id"`
	Position      int             `json:"position"`
	Status        string          `json:"status"`
	Length        *int            `json:"length"`
	Finished      bool            `json:"finished"`
	BeginAt       *string         `json:"begin_at"`
	DetailedStats bool            `json:"detailed_stats"`
	EndAt         *string         `json:"end_at"`
	Forfeit       bool            `json:"forfeit"`
	MatchID       int             `json:"match_id"`
	WinnerType    string          `json:"winner_type"`
	Winner        json.RawMessage `json:"winner"`
}

// NormalizedLive represents the live status embedded in a match.
type NormalizedLive struct {
	Supported bool    `json:"supported"`
	URL       *string `json:"url"`
	OpensAt   *string `json:"opens_at"`
}

// NormalizeLiqMatch converts a raw Liquipedia match to a PandaMatch-compatible struct.
// wiki is the Liquipedia wiki name (e.g. "valorant").
// statusHint, if non-empty, forces the match status (e.g. "running", "not_started", "finished").
func NormalizeLiqMatch(m LiqMatch, wiki string, statusHint string) NormalizedMatch {
	status := computeMatchStatus(m, statusHint)

	// Convert date "YYYY-MM-DD HH:MM:SS" → ISO 8601 "YYYY-MM-DDTHH:MM:SSZ"
	var beginAt *string
	if m.Date != "" {
		iso := strings.ReplaceAll(m.Date, " ", "T") + "Z"
		beginAt = &iso
	}

	// Best of → number_of_games
	var numGames *int
	if m.BestOf > 0 {
		bo := m.BestOf
		numGames = &bo
	}

	slug := pageNameToSlug(m.ObjectName)

	// Name: prefer tickername for display
	name := m.TickerName
	if name == "" {
		name = m.ShortName
	}
	if name == "" {
		name = m.ObjectName
	}

	// Videogame from wiki
	var vg *NormalizedVideogame
	if wiki != "" {
		vgID := videogameIDMap[wiki]
		vgName := videogameNameMap[wiki]
		vgSlug := videogameSlugMap[wiki]
		if vgName == "" {
			vgName = wiki
		}
		if vgSlug == "" {
			vgSlug = wiki
		}
		vg = &NormalizedVideogame{ID: vgID, Name: vgName, Slug: vgSlug}
	}

	// Opponents and results
	opponents, results := normalizeMatchOpponents(m.Match2Opponents)

	// Streams
	streams := normalizeMatchStreams(m.Stream)

	// Games (needs opponents for winner mapping)
	games := normalizeMatchGames(m.Match2Games, m.PageID, opponents)

	// Tournament reference
	tournament := buildMatchTournament(m, vg)

	// League (derived from series/parent)
	league := buildMatchLeague(m)

	// Winner
	var winnerID *int
	var winner interface{}
	if m.Winner != "" && m.Winner != "0" && m.Finished == 1 {
		idx := 0
		if m.Winner == "2" {
			idx = 1
		}
		if idx < len(opponents) && opponents[idx].Opponent != nil {
			wid := opponents[idx].Opponent.ID
			winnerID = &wid
			winner = map[string]interface{}{
				"id":   wid,
				"type": "team",
				"name": opponents[idx].Opponent.Name,
			}
		}
	}

	// Live status
	var live *NormalizedLive
	if status == "running" {
		supported := len(streams) > 0
		var liveURL *string
		if len(streams) > 0 {
			liveURL = &streams[0].RawURL
		}
		live = &NormalizedLive{
			Supported: supported,
			URL:       liveURL,
		}
	}

	return NormalizedMatch{
		ID:            m.PageID,
		Name:          name,
		Slug:          &slug,
		Status:        &status,
		BeginAt:       beginAt,
		ScheduledAt:   beginAt,
		NumberOfGames: numGames,
		Tournament:    tournament,
		Opponents:     opponents,
		Results:       results,
		League:        league,
		StreamsList:   streams,
		Games:         games,
		WinnerID:      winnerID,
		Winner:        winner,
		Live:          live,
		Videogame:     vg,
		Match2ID:      m.Match2ID,
		Wiki:          wiki,
	}
}

// NormalizeLiqMatches normalizes a slice of LiqMatch with deduplication.
func NormalizeLiqMatches(matches []LiqMatch, wiki string, statusHint string) []NormalizedMatch {
	result := make([]NormalizedMatch, 0, len(matches))
	seen := make(map[string]bool)
	for _, m := range matches {
		key := m.UniqueKey()
		if seen[key] {
			continue
		}
		seen[key] = true
		if !m.HasTwoNamedOpponents() {
			continue
		}
		result = append(result, NormalizeLiqMatch(m, wiki, statusHint))
	}
	return result
}

// computeMatchStatus determines the match status for the frontend.
func computeMatchStatus(m LiqMatch, hint string) string {
	if hint != "" {
		return hint
	}
	if m.Finished == 1 {
		return "finished"
	}
	t, err := m.ParsedDate()
	if err != nil {
		return "not_started"
	}
	if t.Before(time.Now().UTC()) {
		return "running"
	}
	return "not_started"
}

// --- Opponent normalization ---

const liquipediaFileURL = "https://liquipedia.net/commons/Special:FilePath/"

// normalizeMatchOpponents parses match2opponents JSON into PandaOpponent[] and PandaMatchResult[].
func normalizeMatchOpponents(raw json.RawMessage) ([]NormalizedOpponent, []NormalizedMatchResult) {
	if raw == nil {
		return []NormalizedOpponent{}, []NormalizedMatchResult{}
	}

	var opponents []LiqOpponent
	if err := json.Unmarshal(raw, &opponents); err != nil {
		return []NormalizedOpponent{}, []NormalizedMatchResult{}
	}

	normalized := make([]NormalizedOpponent, 0, len(opponents))
	results := make([]NormalizedMatchResult, 0, len(opponents))

	for _, opp := range opponents {
		teamID := hashStringToInt(opp.Name)
		if teamID == 0 {
			teamID = hashStringToInt(opp.Template)
		}

		var acronym *string
		if opp.Template != "" {
			a := strings.ToUpper(opp.Template)
			acronym = &a
		}

		var imageURL *string
		if opp.Icon != "" {
			u := liquipediaFileURL + opp.Icon
			imageURL = &u
		}

		team := &NormalizedTeamCompact{
			ID:       teamID,
			Name:     opp.Name,
			Slug:     pageNameToSlug(opp.Name),
			Acronym:  acronym,
			ImageURL: imageURL,
		}

		normalized = append(normalized, NormalizedOpponent{
			ID:       teamID,
			Type:     opp.Type,
			Opponent: team,
		})

		score := parseScore(opp.Score)
		results = append(results, NormalizedMatchResult{
			TeamID: teamID,
			Score:  score,
		})
	}

	return normalized, results
}

// --- Stream normalization ---

// normalizeMatchStreams parses the stream JSON into PandaStream[].
// With rawstreams=true&streamurls=true, the stream field is a map of platform → URL.
func normalizeMatchStreams(raw json.RawMessage) []NormalizedStream {
	if raw == nil || len(raw) == 0 || string(raw) == "null" || string(raw) == "{}" {
		return []NormalizedStream{}
	}

	var streamMap map[string]interface{}
	if err := json.Unmarshal(raw, &streamMap); err != nil {
		return []NormalizedStream{}
	}

	// Priority platforms for main stream designation
	priorityPlatforms := []string{"twitch", "youtube", "twitch2", "twitch3", "afreecatv"}
	streams := make([]NormalizedStream, 0, len(streamMap))
	added := make(map[string]bool)

	// Add priority platforms first
	for _, platform := range priorityPlatforms {
		if val, ok := streamMap[platform]; ok {
			s := buildNormalizedStream(platform, val, len(streams) == 0)
			if s != nil {
				streams = append(streams, *s)
				added[platform] = true
			}
		}
	}

	// Add remaining platforms
	for platform, val := range streamMap {
		if added[platform] {
			continue
		}
		s := buildNormalizedStream(platform, val, len(streams) == 0)
		if s != nil {
			streams = append(streams, *s)
		}
	}

	return streams
}

func buildNormalizedStream(platform string, val interface{}, isMain bool) *NormalizedStream {
	rawVal := fmt.Sprintf("%v", val)
	if rawVal == "" || rawVal == "<nil>" {
		return nil
	}

	// Build full URL if the value is not already a URL
	rawURL := rawVal
	if !strings.HasPrefix(rawVal, "http") {
		rawURL = buildStreamProviderURL(platform, rawVal)
	}

	if rawURL == "" {
		return nil
	}

	embedURL := buildStreamEmbedURL(platform, rawVal)

	return &NormalizedStream{
		Main:     isMain,
		Language: "",
		EmbedURL: embedURL,
		Official: true,
		RawURL:   rawURL,
	}
}

// buildStreamProviderURL constructs a full stream URL from platform and channel/ID.
func buildStreamProviderURL(platform, value string) string {
	switch strings.ToLower(platform) {
	case "twitch", "twitch2", "twitch3":
		return "https://www.twitch.tv/" + value
	case "youtube":
		return "https://www.youtube.com/watch?v=" + value
	case "afreecatv":
		return "https://play.afreecatv.com/" + value
	case "facebook":
		return "https://www.facebook.com/" + value
	case "bilibili":
		return "https://live.bilibili.com/" + value
	case "trovo":
		return "https://trovo.live/" + value
	default:
		return value
	}
}

// buildStreamEmbedURL constructs an embed URL for supported platforms.
func buildStreamEmbedURL(platform, rawVal string) string {
	switch strings.ToLower(platform) {
	case "twitch", "twitch2", "twitch3":
		channel := rawVal
		if strings.HasPrefix(rawVal, "http") {
			parts := strings.Split(strings.TrimRight(rawVal, "/"), "/")
			channel = parts[len(parts)-1]
		}
		return "https://player.twitch.tv/?channel=" + channel + "&parent=esportnews.fr"
	case "youtube":
		videoID := rawVal
		if strings.Contains(rawVal, "watch?v=") {
			parts := strings.Split(rawVal, "watch?v=")
			if len(parts) > 1 {
				videoID = strings.Split(parts[1], "&")[0]
			}
		} else if strings.Contains(rawVal, "/live/") {
			parts := strings.Split(rawVal, "/live/")
			if len(parts) > 1 {
				videoID = parts[1]
			}
		}
		return "https://www.youtube.com/embed/" + videoID
	default:
		return ""
	}
}

// --- Game normalization ---

// normalizeMatchGames parses match2games JSON into PandaGame[].
func normalizeMatchGames(raw json.RawMessage, matchPageID int, opponents []NormalizedOpponent) []NormalizedGameEntry {
	if raw == nil || len(raw) == 0 || string(raw) == "null" || string(raw) == "[]" {
		return []NormalizedGameEntry{}
	}

	var rawGames []json.RawMessage
	if err := json.Unmarshal(raw, &rawGames); err != nil {
		return []NormalizedGameEntry{}
	}

	games := make([]NormalizedGameEntry, 0, len(rawGames))
	for i, rawGame := range rawGames {
		var gameData map[string]interface{}
		if err := json.Unmarshal(rawGame, &gameData); err != nil {
			continue
		}

		finished := false
		switch v := gameData["finished"].(type) {
		case bool:
			finished = v
		case float64:
			finished = v == 1
		}

		status := "not_started"
		if finished {
			status = "finished"
		}

		// Map winner index ("1"/"2") to team ID via opponents
		winnerStr := ""
		if v, ok := gameData["winner"].(string); ok {
			winnerStr = v
		}

		var winnerJSON json.RawMessage
		if winnerStr == "1" && len(opponents) > 0 && opponents[0].Opponent != nil {
			winnerJSON = json.RawMessage(fmt.Sprintf(`{"id":%d,"type":"team"}`, opponents[0].Opponent.ID))
		} else if winnerStr == "2" && len(opponents) > 1 && opponents[1].Opponent != nil {
			winnerJSON = json.RawMessage(fmt.Sprintf(`{"id":%d,"type":"team"}`, opponents[1].Opponent.ID))
		} else {
			winnerJSON = json.RawMessage(`{"id":null,"type":"team"}`)
		}

		games = append(games, NormalizedGameEntry{
			Complete:   finished,
			ID:         matchPageID*100 + i + 1,
			Position:   i + 1,
			Status:     status,
			Finished:   finished,
			MatchID:    matchPageID,
			WinnerType: "team",
			Winner:     winnerJSON,
		})
	}

	return games
}

// --- Tournament/League builders for match context ---

// buildMatchTournament creates a NormalizedTournament from match metadata.
func buildMatchTournament(m LiqMatch, vg *NormalizedVideogame) *NormalizedTournament {
	name := m.TickerName
	if name == "" {
		name = m.ShortName
	}
	if name == "" {
		name = m.Tournament
	}
	if name == "" {
		name = m.Parent
	}

	tier := mapLiquipediaTier(m.LiquipediaTier)

	return &NormalizedTournament{
		ID:             hashStringToInt(m.Tournament),
		Name:           name,
		Slug:           pageNameToSlug(m.Tournament),
		Tier:           tier,
		Videogame:      vg,
		Teams:          []NormalizedTeamCompact{},
		Matches:        []NormalizedMatchCompact{},
		ExpectedRoster: []interface{}{},
		IconURL:        m.IconURL,
		IconDarkURL:    m.IconDarkURL,
	}
}

// buildMatchLeague creates a NormalizedLeague from match series/parent data.
func buildMatchLeague(m LiqMatch) *NormalizedLeague {
	if m.Series == "" && m.Parent == "" {
		return nil
	}

	name := m.Series
	if name == "" {
		name = m.Parent
	}

	return &NormalizedLeague{
		ID:       hashStringToInt(name),
		Name:     name,
		Slug:     pageNameToSlug(name),
		ImageURL: m.IconURL,
	}
}

// --- Helpers ---

// parseScore converts a score value (string or number) to int.
func parseScore(v interface{}) int {
	switch s := v.(type) {
	case float64:
		return int(s)
	case string:
		if n, err := strconv.Atoi(s); err == nil {
			return n
		}
	case json.Number:
		if n, err := s.Int64(); err == nil {
			return int(n)
		}
	}
	return 0
}
