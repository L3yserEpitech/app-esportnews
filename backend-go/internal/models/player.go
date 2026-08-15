package models

import (
	"encoding/json"
	"strings"
	"time"
)

// LiqPlayer mirrors the Liquipedia API v3 /player response.
type LiqPlayer struct {
	PageID         int             `json:"pageid"`
	PageName       string          `json:"pagename"`
	Namespace      int             `json:"namespace"`
	ObjectName     string          `json:"objectname"`
	ID             string          `json:"id"`
	AlternateID    string          `json:"alternateid"`
	Name           string          `json:"name"`
	LocalizedName  string          `json:"localizedname"`
	Type           string          `json:"type"`
	Nationality    string          `json:"nationality"`
	Nationality2   string          `json:"nationality2"`
	Nationality3   string          `json:"nationality3"`
	Region         string          `json:"region"`
	BirthDate      string          `json:"birthdate"`
	DeathDate      string          `json:"deathdate"`
	TeamPageName   string          `json:"teampagename"`
	TeamTemplate   string          `json:"teamtemplate"`
	Links          json.RawMessage `json:"links"`
	Status         string          `json:"status"`
	Earnings       json.Number     `json:"earnings"`
	EarningsByYear json.RawMessage `json:"earningsbyyear"`
	ExtraData      json.RawMessage `json:"extradata"`
}

// LiqTransfer mirrors the Liquipedia API v3 /transfer response.
type LiqTransfer struct {
	Player           string          `json:"player"`
	Nationality      string          `json:"nationality"`
	FromTeam         string          `json:"fromteam"`
	ToTeam           string          `json:"toteam"`
	FromTeamTemplate string          `json:"fromteamtemplate"`
	ToTeamTemplate   string          `json:"toteamtemplate"`
	Role1            string          `json:"role1"`
	Role2            string          `json:"role2"`
	Date             string          `json:"date"`
	WholeTeam        int             `json:"wholeteam"`
	ExtraData        json.RawMessage `json:"extradata"`
}

// NormalizedTransfer is the frontend-facing career step.
type NormalizedTransfer struct {
	Date             string `json:"date"`
	FromTeam         string `json:"from_team"`
	ToTeam           string `json:"to_team"`
	FromTeamTemplate string `json:"from_team_template"`
	ToTeamTemplate   string `json:"to_team_template"`
	Role             string `json:"role"`
}

// NormalizedPlayerDetail is the frontend-facing player profile.
type NormalizedPlayerDetail struct {
	PageID         int                  `json:"pageid"`
	PageName       string               `json:"pagename"`
	ID             string               `json:"id"`
	AlternateID    string               `json:"alternate_id,omitempty"`
	Name           string               `json:"name"`
	LocalizedName  string               `json:"localized_name,omitempty"`
	Nationalities  []string             `json:"nationalities"`
	Region         string               `json:"region,omitempty"`
	BirthDate      string               `json:"birth_date,omitempty"`
	Age            int                  `json:"age,omitempty"`
	TeamPageName   string               `json:"team_pagename,omitempty"`
	TeamTemplate   string               `json:"team_template,omitempty"`
	Links          map[string]string    `json:"links,omitempty"`
	Status         string               `json:"status,omitempty"`
	Earnings       int64                `json:"earnings"`
	EarningsByYear map[string]int64     `json:"earnings_by_year,omitempty"`
	Roles          []string             `json:"roles,omitempty"`
	SignaturePicks []string             `json:"signature_picks,omitempty"`
	FirstName      string               `json:"first_name,omitempty"`
	LastName       string               `json:"last_name,omitempty"`
	ExtraData      json.RawMessage      `json:"extradata,omitempty"`
	Transfers      []NormalizedTransfer `json:"transfers"`
	Wiki           string               `json:"wiki"`
}

// signaturePickKeys are the per-wiki extradata keys holding a player's
// signature picks, in display order. Verified empirically 2026-07.
var signaturePickKeys = map[string][]string{
	"valorant":  {"agent1", "agent2", "agent3"},
	"dota2":     {"hero1", "hero2", "hero3"},
	"overwatch": {"signatureHero1", "signatureHero2", "signatureHero3"},
	// MLBB en expose jusqu'à 5 (vérifié sur le endpoint player du wiki).
	"mobilelegends": {"signatureHero1", "signatureHero2", "signatureHero3", "signatureHero4", "signatureHero5"},
}

// NormalizeLiqPlayer converts a raw Liquipedia player to the frontend shape.
func NormalizeLiqPlayer(p LiqPlayer, wiki string, transfers []NormalizedTransfer) NormalizedPlayerDetail {
	out := NormalizedPlayerDetail{
		PageID:        p.PageID,
		PageName:      p.PageName,
		ID:            p.ID,
		AlternateID:   p.AlternateID,
		Name:          p.Name,
		LocalizedName: p.LocalizedName,
		Region:        p.Region,
		TeamPageName:  p.TeamPageName,
		TeamTemplate:  p.TeamTemplate,
		Status:        p.Status,
		Wiki:          wiki,
		Transfers:     transfers,
	}
	if out.Transfers == nil {
		out.Transfers = []NormalizedTransfer{}
	}

	for _, n := range []string{p.Nationality, p.Nationality2, p.Nationality3} {
		if n != "" {
			out.Nationalities = append(out.Nationalities, n)
		}
	}

	if p.BirthDate != "" && p.BirthDate != "0000-01-01" {
		out.BirthDate = p.BirthDate
		if bd, err := time.Parse("2006-01-02", p.BirthDate); err == nil {
			age := int(time.Since(bd).Hours() / 24 / 365.25)
			if age > 0 && age < 100 {
				out.Age = age
			}
		}
	}

	if v, err := p.Earnings.Int64(); err == nil {
		out.Earnings = v
	}
	if len(p.EarningsByYear) > 0 {
		var byYear map[string]json.Number
		if json.Unmarshal(p.EarningsByYear, &byYear) == nil {
			out.EarningsByYear = make(map[string]int64, len(byYear))
			for y, n := range byYear {
				if v, err := n.Int64(); err == nil {
					out.EarningsByYear[y] = v
				}
			}
		}
	}

	var links map[string]string
	if len(p.Links) > 0 && json.Unmarshal(p.Links, &links) == nil {
		out.Links = links
	}

	out.ExtraData = p.ExtraData
	var ed map[string]json.RawMessage
	if len(p.ExtraData) > 0 && json.Unmarshal(p.ExtraData, &ed) == nil {
		str := func(key string) string {
			var s string
			if raw, ok := ed[key]; ok && json.Unmarshal(raw, &s) == nil {
				return strings.TrimSpace(s)
			}
			return ""
		}

		out.FirstName = str("firstname")
		out.LastName = str("lastname")

		// Roles: "roles" is a Lua object {"1": "coach", "2": "top"} or an empty array.
		if raw, ok := ed["roles"]; ok {
			var rolesMap map[string]string
			if json.Unmarshal(raw, &rolesMap) == nil {
				for _, k := range []string{"1", "2", "3"} {
					if r := strings.TrimSpace(rolesMap[k]); r != "" {
						out.Roles = append(out.Roles, r)
					}
				}
			}
		}
		if len(out.Roles) == 0 {
			if r := str("role"); r != "" {
				out.Roles = append(out.Roles, r)
			}
			if r := str("role2"); r != "" {
				out.Roles = append(out.Roles, r)
			}
		}

		if keys, ok := signaturePickKeys[wiki]; ok {
			for _, k := range keys {
				if v := str(k); v != "" {
					out.SignaturePicks = append(out.SignaturePicks, v)
				}
			}
		}
	}

	return out
}

// NormalizeLiqTransfer converts a raw transfer to the frontend shape.
func NormalizeLiqTransfer(t LiqTransfer) NormalizedTransfer {
	role := t.Role1
	if role == "" {
		role = t.Role2
	}
	return NormalizedTransfer{
		Date:             t.Date,
		FromTeam:         t.FromTeam,
		ToTeam:           t.ToTeam,
		FromTeamTemplate: t.FromTeamTemplate,
		ToTeamTemplate:   t.ToTeamTemplate,
		Role:             role,
	}
}
