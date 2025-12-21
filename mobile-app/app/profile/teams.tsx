import { View, StyleSheet, FlatList, Alert, TextInput as RNTextInput } from 'react-native';
import { useState } from 'react';
import { Text, ActivityIndicator, IconButton, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks';
import { Button, Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

interface Team {
  id: number;
  name: string;
  acronym: string;
  image_url?: string;
}

export default function TeamsScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [favoriteTeams, setFavoriteTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Search teams
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);

      // TODO: API call to search teams
      // const results = await teamService.searchTeams(query);
      // setSearchResults(results);

      // For now, simulate API call with mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      setSearchResults([
        { id: 1, name: 'Team Liquid', acronym: 'TL' },
        { id: 2, name: 'Cloud9', acronym: 'C9' },
        { id: 3, name: 'G2 Esports', acronym: 'G2' },
      ]);
    } catch (error) {
      console.error('Error searching teams:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Add team to favorites
  const handleAddTeam = async (team: Team) => {
    try {
      setIsLoading(true);

      // Check if already favorite
      if (favoriteTeams.some(t => t.id === team.id)) {
        Alert.alert('Info', 'Cette équipe est déjà dans vos favoris');
        return;
      }

      // TODO: API call to add favorite team
      // await userService.addFavoriteTeam(team.id);

      // For now, update local state
      setFavoriteTeams([...favoriteTeams, team]);
      setSearchQuery('');
      setSearchResults([]);

      Alert.alert('Succès', `${team.name} ajouté à vos favoris`);
    } catch (error) {
      console.error('Error adding team:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'équipe');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove team from favorites
  const handleRemoveTeam = async (teamId: number) => {
    try {
      setIsLoading(true);

      // TODO: API call to remove favorite team
      // await userService.removeFavoriteTeam(teamId);

      // For now, update local state
      setFavoriteTeams(favoriteTeams.filter(t => t.id !== teamId));

      await refreshUser();
    } catch (error) {
      console.error('Error removing team:', error);
      Alert.alert('Erreur', 'Impossible de supprimer l\'équipe');
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm removal
  const confirmRemoveTeam = (team: Team) => {
    Alert.alert(
      'Supprimer l\'équipe',
      `Voulez-vous retirer ${team.name} de vos favoris ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => handleRemoveTeam(team.id),
        },
      ]
    );
  };

  // Render swipeable delete action
  const renderRightActions = (team: Team) => {
    return (
      <View style={styles.swipeAction}>
        <IconButton
          icon="delete"
          iconColor={COLORS.background}
          size={24}
          onPress={() => confirmRemoveTeam(team)}
        />
      </View>
    );
  };

  // Render favorite team item
  const renderFavoriteTeam = ({ item }: { item: Team }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item)}
      overshootRight={false}
      friction={2}
    >
      <Card variant="outlined" padding="md" style={styles.teamCard}>
        <View style={styles.teamRow}>
          <View style={styles.teamAvatar}>
            {item.image_url ? (
              <MaterialCommunityIcons name="shield" size={32} color={COLORS.primary} />
            ) : (
              <MaterialCommunityIcons name="shield-outline" size={32} color={COLORS.textSecondary} />
            )}
          </View>
          <View style={styles.teamInfo}>
            <Text variant="bodyLarge" style={styles.teamName}>
              {item.name}
            </Text>
            {item.acronym && (
              <Text variant="bodySmall" style={styles.teamAcronym}>
                {item.acronym}
              </Text>
            )}
          </View>
          <MaterialCommunityIcons
            name="chevron-left"
            size={20}
            color={COLORS.textMuted}
          />
        </View>
      </Card>
    </Swipeable>
  );

  // Render search result item
  const renderSearchResult = ({ item }: { item: Team }) => (
    <Button
      variant="outline"
      onPress={() => handleAddTeam(item)}
      style={styles.searchResultCard}
    >
      <View style={styles.teamRow}>
        <View style={styles.teamAvatar}>
          <MaterialCommunityIcons name="shield-outline" size={32} color={COLORS.textSecondary} />
        </View>
        <View style={styles.teamInfo}>
          <Text variant="bodyLarge" style={styles.teamName}>
            {item.name}
          </Text>
          {item.acronym && (
            <Text variant="bodySmall" style={styles.teamAcronym}>
              {item.acronym}
            </Text>
          )}
        </View>
        <MaterialCommunityIcons name="plus" size={24} color={COLORS.primary} />
      </View>
    </Button>
  );

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="heart-outline" size={64} color={COLORS.textMuted} />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        Aucune équipe favorite
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Recherchez et ajoutez vos équipes préférées
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Équipes favorites
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {favoriteTeams.length} équipe{favoriteTeams.length > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Search Bar */}
        <Searchbar
          placeholder="Rechercher une équipe..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchBarInput}
          iconColor={COLORS.textSecondary}
          loading={isSearching}
        />

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            <Text variant="labelLarge" style={styles.searchResultsTitle}>
              Résultats ({searchResults.length})
            </Text>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderSearchResult}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
              style={styles.searchResultsList}
            />
          </View>
        )}

        {/* Favorite Teams List */}
        <View style={styles.favoritesList}>
          <FlatList
            data={favoriteTeams}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderFavoriteTeam}
            ListEmptyComponent={searchResults.length === 0 ? renderEmpty : null}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            contentContainerStyle={styles.listContent}
          />
        </View>

        {/* Swipe Hint */}
        {favoriteTeams.length > 0 && (
          <View style={styles.hintContainer}>
            <MaterialCommunityIcons
              name="gesture-swipe-left"
              size={16}
              color={COLORS.textMuted}
            />
            <Text variant="bodySmall" style={styles.hintText}>
              Glissez vers la gauche pour supprimer
            </Text>
          </View>
        )}

        {/* Back Button */}
        <Button
          variant="outline"
          onPress={() => router.back()}
          disabled={isLoading}
          style={styles.backButton}
        >
          Retour
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: COLORS.textSecondary,
  },
  searchBar: {
    backgroundColor: COLORS.surface,
    marginBottom: spacing.md,
  },
  searchBarInput: {
    color: COLORS.text,
  },
  searchResults: {
    marginBottom: spacing.md,
    maxHeight: 250,
  },
  searchResultsTitle: {
    color: COLORS.text,
    marginBottom: spacing.sm,
  },
  searchResultsList: {
    flexGrow: 0,
  },
  searchResultCard: {
    marginBottom: spacing.xs,
  },
  favoritesList: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  teamCard: {
    marginBottom: 0,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: COLORS.text,
    marginBottom: spacing.xs,
  },
  teamAcronym: {
    color: COLORS.textSecondary,
  },
  swipeAction: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    color: COLORS.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  hintText: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  backButton: {
    marginTop: spacing.md,
  },
});
