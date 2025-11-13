package services

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/esportnews/backend/internal/models"
)

type TeamService struct {
	db *pgxpool.Pool
}

func NewTeamService(db *pgxpool.Pool) *TeamService {
	return &TeamService{db: db}
}

// SearchTeams searches teams by name
func (s *TeamService) SearchTeams(ctx context.Context, query string, limit int) ([]*models.Team, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, name, acronym, logo, panda_id FROM teams 
		 WHERE name ILIKE $1 LIMIT $2`,
		"%"+query+"%", limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to search teams: %w", err)
	}
	defer rows.Close()

	var teams []*models.Team
	for rows.Next() {
		var t models.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.Acronym, &t.Logo, &t.PandaID); err != nil {
			return nil, fmt.Errorf("failed to scan team: %w", err)
		}
		teams = append(teams, &t)
	}

	return teams, nil
}

// AddFavoriteTeam adds a team to user favorites
func (s *TeamService) AddFavoriteTeam(ctx context.Context, userID, teamID int64) error {
	_, err := s.db.Exec(ctx,
		`UPDATE public.users SET favorite_teams = array_append(favorite_teams, $1) 
		 WHERE id = $2 AND NOT $1 = ANY(favorite_teams)`,
		teamID, userID,
	)
	return err
}

// RemoveFavoriteTeam removes a team from user favorites
func (s *TeamService) RemoveFavoriteTeam(ctx context.Context, userID, teamID int64) error {
	_, err := s.db.Exec(ctx,
		`UPDATE public.users SET favorite_teams = array_remove(favorite_teams, $1) 
		 WHERE id = $2`,
		teamID, userID,
	)
	return err
}

// GetFavoriteTeams retrieves user's favorite teams
func (s *TeamService) GetFavoriteTeams(ctx context.Context, userID int64) ([]*models.Team, error) {
	var teamIDs []int64
	err := s.db.QueryRow(ctx, "SELECT favorite_teams FROM public.users WHERE id = $1", userID).Scan(&teamIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get favorite team IDs: %w", err)
	}

	if len(teamIDs) == 0 {
		return []*models.Team{}, nil
	}

	rows, err := s.db.Query(ctx,
		`SELECT id, name, acronym, logo, panda_id FROM teams WHERE id = ANY($1)`,
		teamIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get teams: %w", err)
	}
	defer rows.Close()

	var teams []*models.Team
	for rows.Next() {
		var t models.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.Acronym, &t.Logo, &t.PandaID); err != nil {
			return nil, fmt.Errorf("failed to scan team: %w", err)
		}
		teams = append(teams, &t)
	}

	return teams, nil
}
