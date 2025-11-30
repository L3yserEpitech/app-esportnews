package services

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

type TeamService struct {
	db            interface{} // Can be *gorm.DB or *database.Database
	pandaService  *PandaScoreService
}

func NewTeamService(db interface{}, pandaService *PandaScoreService) *TeamService {
	return &TeamService{db: db, pandaService: pandaService}
}

// getDB extracts the *gorm.DB from the interface
func (s *TeamService) getDB() *gorm.DB {
	switch v := s.db.(type) {
	case *gorm.DB:
		return v
	case *database.Database:
		return v.DB // Access the embedded *gorm.DB
	default:
		panic("TeamService db is not a valid *gorm.DB or *database.Database instance")
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

// AddFavoriteTeam adds a team to user favorites (max 3 teams)
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

	// Check max limit (3 teams)
	if len(user.FavoriteTeams) >= 3 {
		return fmt.Errorf("vous ne pouvez avoir que 3 équipes favorites")
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

// GetFavoriteTeams retrieves user's favorite teams from PandaScore API
func (s *TeamService) GetFavoriteTeams(ctx context.Context, userID int64) ([]models.PandaTeam, error) {
	var user models.User
	if err := s.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to get favorite team IDs: %w", err)
	}

	if len(user.FavoriteTeams) == 0 {
		return []models.PandaTeam{}, nil
	}

	// Fetch team details from PandaScore API
	if s.pandaService == nil {
		return nil, fmt.Errorf("PandaScore service not available")
	}

	teams, err := s.pandaService.GetTeams(ctx, user.FavoriteTeams)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch team details: %w", err)
	}

	return teams, nil
}
