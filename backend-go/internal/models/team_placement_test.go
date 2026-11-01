package models

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeLiqPlacementExposesTheTournamentPageID(t *testing.T) {
	np := NormalizeLiqPlacement(LiqPlacement{
		PageID:     362800,
		PageName:   "PGL/2026/Masters",
		Tournament: "PGL Masters Bucharest 2026",
	})

	require.Equal(t, 362800, np.TournamentID)
	require.Equal(t, "PGL/2026/Masters", np.TournamentPage)
}
