package services

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/models"
)

type TeamService struct {
	db interface{} // Can be *gorm.DB or *database.Database
}

func NewTeamService(db interface{}) *TeamService {
	return &TeamService{db: db}
}

// getDB extracts the *gorm.DB from the interface
func (s *TeamService) getDB() *gorm.DB {
	switch v := s.db.(type) {
	case *gorm.DB:
		return v
	default:
		panic("TeamService db is not a valid *gorm.DB instance")
	}
}

// SearchTeams searches teams by name
func (s *TeamService) SearchTeams(ctx context.Context, query string, limit int) ([]*models.Team, error) {
	var teams []*models.Team
	if err := s.getDB().WithContext(ctx).
		Where("name ILIKE ?", "%"+query+"%").
		Limit(limit).
		Find(&teams).Error; err != nil {
		return nil, fmt.Errorf("failed to search teams: %w", err)
	}
	return teams, nil
}

// AddFavoriteTeam adds a team to user favorites
func (s *TeamService) AddFavoriteTeam(ctx context.Context, userID, teamID int64) error {
	// Get current favorite teams
	var user models.User
	if err := s.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return fmt.Errorf("failed to fetch user: %w", err)
	}

	// Check if team is already in favorites
	for _, id := range user.FavoriteTeams {
		if id == teamID {
			return nil // Already a favorite
		}
	}

	// Add team to favorites
	user.FavoriteTeams = append(user.FavoriteTeams, teamID)
	if err := s.getDB().WithContext(ctx).Model(&user).Update("favorite_teams", user.FavoriteTeams).Error; err != nil {
		return fmt.Errorf("failed to add favorite team: %w", err)
	}
	return nil
}

// RemoveFavoriteTeam removes a team from user favorites
func (s *TeamService) RemoveFavoriteTeam(ctx context.Context, userID, teamID int64) error {
	// Get current favorite teams
	var user models.User
	if err := s.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return fmt.Errorf("failed to fetch user: %w", err)
	}

	// Remove team from favorites
	newFavorites := []int64{}
	for _, id := range user.FavoriteTeams {
		if id != teamID {
			newFavorites = append(newFavorites, id)
		}
	}

	if err := s.getDB().WithContext(ctx).Model(&user).Update("favorite_teams", newFavorites).Error; err != nil {
		return fmt.Errorf("failed to remove favorite team: %w", err)
	}
	return nil
}

// GetFavoriteTeams retrieves user's favorite teams
func (s *TeamService) GetFavoriteTeams(ctx context.Context, userID int64) ([]*models.Team, error) {
	var user models.User
	if err := s.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to get favorite team IDs: %w", err)
	}

	if len(user.FavoriteTeams) == 0 {
		return []*models.Team{}, nil
	}

	// For now, return empty list as teams table functionality isn't fully implemented
	// In the future, this would fetch team details from the teams table or PandaScore API
	return []*models.Team{}, nil
}
