import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { teamService } from '@/services/teamService';
import { imageUrl } from '@/utils/imageUrl';
import { useAuth } from '@/hooks/useAuth';
import { videogameSlugToWiki } from '@/utils/gameRegistry';
import type { NormalizedTeam } from '@/types';

// Search results carry current_videogame.slug (internal slug e.g. "cs2"), not the
// raw wiki. Map it to the wiki so team/[id] gets a usable hint (avoids a 10-wiki
// fan-out); the screen still resolves the authoritative wiki from detail.wiki.
function teamWiki(team: NormalizedTeam): string {
  return videogameSlugToWiki(team.current_videogame?.slug) ?? '';
}

function TeamRow({
  team,
  onPress,
  onRemoveFavorite,
}: {
  team: NormalizedTeam;
  onPress: () => void;
  onRemoveFavorite?: () => void;
}) {
  const logo = imageUrl(team.image_url);
  const game = team.current_videogame?.name;
  const meta = [team.location, game].filter(Boolean).join(' · ');

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.logoBox}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" />
        ) : (
          <MaterialCommunityIcons name="shield-outline" size={22} color={COLORS.textMuted} />
        )}
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowName} numberOfLines={1}>
          {team.name}
        </Text>
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : team.acronym ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {team.acronym}
          </Text>
        ) : null}
      </View>
      {onRemoveFavorite ? (
        <Pressable onPress={onRemoveFavorite} hitSlop={10} style={styles.starButton}>
          <MaterialCommunityIcons name="star" size={22} color={COLORS.tierS} />
        </Pressable>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
      )}
    </Pressable>
  );
}

export default function TeamsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<NormalizedTeam[]>([]);
  const [searching, setSearching] = useState(false);

  const [favorites, setFavorites] = useState<NormalizedTeam[]>([]);
  const [favLoading, setFavLoading] = useState(false);

  const seq = useRef(0);

  // Debounce the search query (~300ms).
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    teamService.searchTeams(debounced, 20).then((teams) => {
      if (id !== seq.current) return; // stale response
      setResults(teams);
      setSearching(false);
    });
  }, [debounced]);

  const loadFavorites = useCallback(async () => {
    if (!isAuthenticated) {
      setFavorites([]);
      return;
    }
    setFavLoading(true);
    const teams = await teamService.getFavoriteTeams();
    setFavorites(teams);
    setFavLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const goToTeam = useCallback(
    (team: NormalizedTeam) => {
      router.push({
        pathname: '/team/[id]',
        params: { id: String(team.id), wiki: teamWiki(team) },
      });
    },
    [router]
  );

  const removeFavorite = useCallback(async (teamId: number) => {
    setFavorites((prev) => prev.filter((t) => t.id !== teamId));
    await teamService.removeFavoriteTeam(teamId);
  }, []);

  const showFavorites = isAuthenticated && !debounced;

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Search input */}
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.primary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une équipe..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {/* Favorites section */}
      {showFavorites ? (
        <View style={styles.favSection}>
          <Text style={styles.sectionTitle}>Mes équipes</Text>
          {favLoading ? (
            <View style={styles.favLoader}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : favorites.length > 0 ? (
            favorites.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                onPress={() => goToTeam(team)}
                onRemoveFavorite={() => removeFavorite(team.id)}
              />
            ))
          ) : (
            <Text style={styles.hint}>
              Aucune équipe suivie. Recherche une équipe pour l'ajouter.
            </Text>
          )}
        </View>
      ) : !isAuthenticated && !debounced ? (
        <View style={styles.favSection}>
          <Text style={styles.hint}>Connecte-toi pour suivre des équipes.</Text>
        </View>
      ) : null}

      {debounced ? <Text style={styles.sectionTitle}>Résultats</Text> : null}
    </View>
  );

  const renderEmpty = () => {
    if (!debounced) return null;
    if (searching) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Recherche en cours...</Text>
        </View>
      );
    }
    return (
      <View style={styles.centerState}>
        <MaterialCommunityIcons name="shield-off-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.stateText}>Aucune équipe trouvée</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top header with back button */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Équipes</Text>
        <View style={styles.iconButton} />
      </View>

      <FlatList
        data={debounced ? results : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <TeamRow team={item} onPress={() => goToTeam(item)} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listHeader: {
    paddingTop: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  favSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  favLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 36,
    height: 36,
  },
  rowContent: {
    flex: 1,
  },
  rowName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  starButton: {
    padding: 4,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: spacing.md,
  },
  stateText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
