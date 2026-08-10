package services

import (
	"context"
	"strings"
	"time"

	"github.com/esportnews/backend/internal/models"
)

// Fenêtre de création. Le cache upcoming n'a pas de borne haute : sans elle on
// créerait des abonnements pour des matchs à plusieurs mois, qui dormiraient en
// base. Le passage tournant toutes les 10 min, la fenêtre avance seule.
const favoriteTeamMatchWindow = 7 * 24 * time.Hour

// normalizeTeamName aligne les noms avant comparaison. On ne peut pas joindre
// par identifiant : l'id d'un opponent est un hashStringToInt de son nom, sans
// rapport avec le pageid stocké en favori.
func normalizeTeamName(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(s)), " ")
}

// favoriteTeam est une équipe favorite résolue, prête à être comparée.
type favoriteTeam struct {
	PageID int64
	Wiki   string
	Name   string // déjà normalisé
}

// matchInvolves indique si l'un des opponents du match est l'équipe donnée.
func matchInvolves(m models.NormalizedMatch, teamName string) bool {
	for _, o := range m.Opponents {
		if o.Opponent == nil {
			continue
		}
		if normalizeTeamName(o.Opponent.Name) == teamName {
			return true
		}
	}
	return false
}

// hydrateFavoriteTeamMatches crée les abonnements match des équipes favorites.
//
// Réservé aux comptes Premium. Il purge aussi les lignes des utilisateurs qui
// ont perdu le statut : elles vivraient sinon leur vie, la boucle de
// notification de 60 s ne regardant pas le Premium.
func (s *NotificationScheduler) hydrateFavoriteTeamMatches(ctx context.Context) {
	s.purgeLapsedFavoriteTeamSubs(ctx)

	db := s.getDB()

	var users []models.User
	if err := db.WithContext(ctx).
		Where("premium = ? AND COALESCE(array_length(favorite_teams, 1), 0) > 0", true).
		Find(&users).Error; err != nil {
		s.logger.Errorf("[FavTeams] Failed to load premium users with favorites: %v", err)
		return
	}
	if len(users) == 0 {
		return
	}

	// Résolution des pageids en nom + wiki, dédupliquée : plusieurs utilisateurs
	// suivent souvent les mêmes équipes.
	pageIDs := make([]int64, 0)
	seenID := make(map[int64]bool)
	for _, u := range users {
		for _, id := range u.FavoriteTeams {
			if !seenID[id] {
				seenID[id] = true
				pageIDs = append(pageIDs, id)
			}
		}
	}

	resolved := make(map[int64]favoriteTeam, len(pageIDs))
	for _, t := range s.liqService.GetTeamsByPageIDs(ctx, pageIDs) {
		slug := ""
		if t.CurrentVideogame != nil {
			slug = t.CurrentVideogame.Slug
		}
		wiki, ok := models.ResolveWiki(slug)
		if !ok || t.Name == "" {
			// Sans wiki on balaierait les dix caches, ce qui rouvrirait le risque
			// d'homonymie entre jeux.
			s.logger.Warnf("[FavTeams] Skipping team %d (%q): unresolved wiki from slug %q", t.ID, t.Name, slug)
			continue
		}
		resolved[int64(t.ID)] = favoriteTeam{
			PageID: int64(t.ID),
			Wiki:   wiki,
			Name:   normalizeTeamName(t.Name),
		}
	}
	if len(resolved) == 0 {
		return
	}

	// Un seul passage de lecture par wiki, quel que soit le nombre d'abonnés.
	wikis := make(map[string]bool)
	for _, ft := range resolved {
		wikis[ft.Wiki] = true
	}
	upcoming := make(map[string][]models.NormalizedMatch, len(wikis))
	for wiki := range wikis {
		matches, err := s.liqService.MatchesByStatus(ctx, wiki, MatchStatusUpcoming)
		if err != nil {
			s.logger.Warnf("[FavTeams] Failed to read upcoming cache for %s: %v", wiki, err)
			continue
		}
		upcoming[wiki] = matches
	}

	now := time.Now().UTC()
	cutoff := now.Add(favoriteTeamMatchWindow)
	matchedAny := make(map[int64]bool)
	created := 0

	for _, u := range users {
		for _, pageID := range u.FavoriteTeams {
			ft, ok := resolved[pageID]
			if !ok {
				continue
			}

			for _, m := range upcoming[ft.Wiki] {
				if !matchInvolves(m, ft.Name) {
					continue
				}
				matchedAny[pageID] = true

				beginAt := matchBeginsAt(m)
				if beginAt == nil || beginAt.After(cutoff) || beginAt.Before(now) {
					continue
				}

				matchID := int64(m.ID)
				if matchID == 0 {
					continue
				}

				var count int64
				if err := db.WithContext(ctx).Model(&models.MatchSubscription{}).
					Where("user_id = ? AND match_id = ?", u.ID, matchID).
					Count(&count).Error; err != nil {
					s.logger.Errorf("[FavTeams] Failed to count subs for user %d match %d: %v", u.ID, matchID, err)
					continue
				}
				if count > 0 {
					// Déjà couvert par un autre chemin (abonnement direct ou tournoi).
					// La contrainte unique (user_id, match_id) garantit une seule notif.
					continue
				}

				teamPageID := ft.PageID
				tournamentName := ""
				if m.Tournament != nil {
					tournamentName = m.Tournament.Name
				}
				gameAcronym := ""
				if m.Videogame != nil {
					gameAcronym = m.Videogame.Slug
				}

				sub := models.MatchSubscription{
					UserID:         u.ID,
					MatchID:        matchID,
					Match2ID:       m.Match2ID,
					GameAcronym:    gameAcronym,
					MatchName:      m.Name,
					TournamentName: tournamentName,
					BeginAt:        beginAt,
					Status:         "upcoming",
					FromTeam:       &teamPageID,
				}
				if err := db.WithContext(ctx).Create(&sub).Error; err != nil {
					s.logger.Errorf("[FavTeams] Failed to create sub for user %d match %d: %v", u.ID, matchID, err)
					continue
				}
				created++
			}
		}
	}

	// Un favori qui ne matche jamais rien signale une divergence d'orthographe
	// entre sa fiche et ses matchs. Sans ce log, le trou serait invisible.
	for pageID, ft := range resolved {
		if !matchedAny[pageID] {
			s.logger.Warnf("[FavTeams] Team %d (%q, %s) matched no upcoming match", pageID, ft.Name, ft.Wiki)
		}
	}

	if created > 0 {
		s.logger.Infof("[FavTeams] Created %d match subscriptions from favorite teams", created)
	}
}

// purgeLapsedFavoriteTeamSubs retire les abonnements issus d'une équipe favorite
// pour les comptes qui ne sont plus Premium. Les lignes déjà notifiées restent :
// elles sont l'historique de ce qui a été envoyé.
func (s *NotificationScheduler) purgeLapsedFavoriteTeamSubs(ctx context.Context) {
	res := s.getDB().WithContext(ctx).
		Where(`from_team IS NOT NULL AND notified_start = ? AND user_id IN (
			SELECT id FROM users WHERE premium IS NULL OR premium = ?
		)`, false, false).
		Delete(&models.MatchSubscription{})
	if res.Error != nil {
		s.logger.Errorf("[FavTeams] Failed to purge lapsed subscriptions: %v", res.Error)
		return
	}
	if res.RowsAffected > 0 {
		s.logger.Infof("[FavTeams] Purged %d subscriptions from lapsed premium accounts", res.RowsAffected)
	}
}
