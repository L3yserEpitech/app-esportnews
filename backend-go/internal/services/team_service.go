package services

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
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
	case *database.Database:
		return v.DB
	default:
		panic("TeamService db is not a valid *gorm.DB or *database.Database instance")
	}
}

// AddFavoriteTeam adds a team to user favorites (max 3 teams)
func (s *TeamService) AddFavoriteTeam(ctx context.Context, userID, teamID int64) error {
	var user models.User
	if err := s.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return fmt.Errorf("failed to fetch user: %w", err)
	}

	// Check if team is already in favorites
	for _, id := range user.FavoriteTeams {
		if id == teamID {
			return nil
		}
	}

	// Check max limit (3 teams)
	if len(user.FavoriteTeams) >= 3 {
		return fmt.Errorf("vous ne pouvez avoir que 3 equipes favorites")
	}

	user.FavoriteTeams = append(user.FavoriteTeams, teamID)
	if err := s.getDB().WithContext(ctx).Model(&user).Update("favorite_teams", user.FavoriteTeams).Error; err != nil {
		return fmt.Errorf("failed to add favorite team: %w", err)
	}
	return nil
}

// RemoveFavoriteTeam removes a team from user favorites
func (s *TeamService) RemoveFavoriteTeam(ctx context.Context, userID, teamID int64) error {
	var user models.User
	if err := s.getDB().WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return fmt.Errorf("failed to fetch user: %w", err)
	}

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
