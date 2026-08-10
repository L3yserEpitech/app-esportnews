import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { teamService } from '@/services/teamService';
import { imageUrl } from '@/utils/imageUrl';
import { useAuth } from '@/hooks/useAuth';
import { useAdPopup, useSubscription } from '@/hooks';
import { LiveMatchCard } from '@/components/features';
import { LiquipediaBadge } from '@/components/ui';
import { SectionHeader } from '@/components/tournament-detail/sections/shared';
import type {
  TeamDetail,
  TeamMatchesResponse,
  NormalizedPlacement,
  NormalizedPlayer,
  TeamLinks,
} from '@/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ── Role color ────────────────────────────────────────────────────────────
function roleColor(role?: string | null): string {
  if (!role) return COLORS.textMuted;
  const l = role.toLowerCase();
  if (l.includes('captain') || l.includes('igl')) return '#22d3ee';
  if (l.includes('coach')) return '#fbbf24';
  if (l.includes('mid')) return '#60a5fa';
  if (l.includes('adc') || l.includes('bot')) return '#4ade80';
  if (l.includes('support') || l.includes('sup')) return '#facc15';
  if (l.includes('top')) return '#f87171';
  if (l.includes('jungl') || l.includes('jgl')) return '#c084fc';
  if (l.includes('awp') || l.includes('sniper')) return '#fb923c';
  return COLORS.textSecondary;
}

// ── Social links config ───────────────────────────────────────────────────
const SOCIAL: { key: keyof TeamLinks; icon: IconName }[] = [
  { key: 'twitter', icon: 'twitter' },
  { key: 'youtube', icon: 'youtube' },
  { key: 'twitch', icon: 'twitch' },
  { key: 'discord', icon: 'message-text' },
  { key: 'instagram', icon: 'instagram' },
  { key: 'facebook', icon: 'facebook' },
  { key: 'website', icon: 'web' },
];

// ── Player row ────────────────────────────────────────────────────────────
function PlayerRow({ player, wiki }: { player: NormalizedPlayer; wiki?: string }) {
  const router = useRouter();
  const portrait = imageUrl(player.image_url);
  const rc = roleColor(player.role);
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');

  return (
    <Pressable
      style={({ pressed }) => [styles.playerRow, pressed && styles.pressed]}
      onPress={() =>
        router.push({
          pathname: '/player/[pagename]',
          params: { pagename: player.slug ?? player.name, wiki: wiki ?? '' },
        })
      }
    >
      <View style={styles.playerAvatar}>
        {portrait ? (
          <Image source={{ uri: portrait }} style={styles.playerAvatarImg} contentFit="cover" />
        ) : (
          <Text style={styles.playerInitials}>{player.name.slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, !player.active && styles.formerName]} numberOfLines={1}>
          {player.name}
          {!player.active ? <Text style={styles.exTag}>  EX</Text> : null}
        </Text>
        {fullName ? <Text style={styles.playerFullName} numberOfLines={1}>{fullName}</Text> : null}
      </View>
      <View style={styles.playerMeta}>
        {player.role ? (
          <Text style={[styles.playerRole, { color: rc }]} numberOfLines={1}>{player.role}</Text>
        ) : null}
        {player.nationality ? (
          <Text style={styles.playerNat} numberOfLines={1}>{player.nationality}</Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textMuted} />
    </Pressable>
  );
}

// ── Placement row ─────────────────────────────────────────────────────────
function PlacementRow({ p }: { p: NormalizedPlacement }) {
  const placementColor =
    p.placement === '1' ? COLORS.tierS
    : p.placement === '2' ? COLORS.tierA
    : p.placement === '3' ? COLORS.tierB
    : COLORS.textSecondary;
  const isTop3 = ['1', '2', '3'].includes(p.placement);
  const icon = imageUrl(p.icon_url);
  const date = p.date
    ? (() => {
        const d = new Date(p.date);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
      })()
    : '';
  const prize = p.prize_money > 0 ? `$${Math.round(p.prize_money).toLocaleString('en-US')}` : '';

  return (
    <View style={styles.placementRow}>
      <View style={styles.placementBadge}>
        {isTop3 ? (
          <MaterialCommunityIcons name="trophy" size={13} color={placementColor} />
        ) : null}
        <Text style={[styles.placementText, { color: placementColor }]}>{p.placement}</Text>
      </View>
      {icon ? (
        <View style={styles.placementIconBox}>
          <Image source={{ uri: icon }} style={styles.placementIcon} contentFit="contain" />
        </View>
      ) : null}
      <View style={styles.placementInfo}>
        <Text style={styles.placementName} numberOfLines={1}>{p.tournament}</Text>
        <View style={styles.placementSub}>
          {p.tier ? <Text style={styles.placementTier}>T{p.tier}</Text> : null}
          {prize ? <Text style={styles.placementPrize}>{prize}</Text> : null}
          {date ? <Text style={styles.placementDate}>{date}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export default function TeamDetailScreen() {
  const { id, wiki, template, name } = useLocalSearchParams<{
    id: string;
    wiki?: string;
    template?: string;
    name?: string;
  }>();
  const wikiParam = typeof wiki === 'string' && wiki.length > 0 ? wiki : undefined;
  const templateParam = typeof template === 'string' && template.length > 0 ? template : undefined;
  const nameParam = typeof name === 'string' && name.length > 0 ? name : undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [matches, setMatches] = useState<TeamMatchesResponse>({ recent: [], upcoming: [] });
  const [placements, setPlacements] = useState<NormalizedPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  const { isSubscribed } = useSubscription();
  const { showAd } = useAdPopup({ skipIfSubscribed: true, isSubscribed });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      // Depuis un match ou un tournoi, `id` est un hash du nom d'équipe, pas un
      // pageid : /teams/:id/detail balaie alors les 10 wikis avant de rendre
      // 404 (~20 s d'attente). Le template est le seul identifiant résoluble.
      const detail = templateParam && wikiParam
        ? await teamService.getTeamDetailByTemplate(templateParam, wikiParam, nameParam)
        : await teamService.getTeamDetail(Number(id), wikiParam);
      if (!detail) {
        setError('Équipe introuvable');
        return;
      }
      setTeam(detail);

      const resolvedWiki = detail.wiki ?? wikiParam;
      // Matches + placements are non-blocking; each has its own guards.
      if (resolvedWiki && detail.template) {
        teamService
          .getTeamMatches(detail.id, resolvedWiki, detail.template, detail.name)
          .then(setMatches)
          .catch(() => {});
      }
      if (resolvedWiki && detail.name) {
        teamService
          .getTeamPlacements(detail.id, resolvedWiki, detail.name, 30)
          .then((res) => setPlacements(res.placements))
          .catch(() => {});
      }
    } catch {
      setError("Erreur lors du chargement de l'équipe");
    } finally {
      setLoading(false);
    }
  }, [id, wikiParam, templateParam, nameParam]);

  useEffect(() => {
    load();
    return () => { showAd(); };
  }, [load, showAd]);

  // Determine initial favorite state (logged-in users only).
  useEffect(() => {
    if (!isAuthenticated || !id) return;
    let active = true;
    teamService.getFavoriteTeamIds().then((ids) => {
      if (active) setIsFavorite(ids.includes(Number(id)));
    });
    return () => { active = false; };
  }, [isAuthenticated, id]);

  const toggleFavorite = useCallback(async () => {
    if (!isAuthenticated) {
      Alert.alert('Connexion requise', 'Connectez-vous pour ajouter des équipes en favoris.');
      return;
    }
    if (favBusy) return;
    setFavBusy(true);
    const teamId = Number(id);
    const next = !isFavorite;
    setIsFavorite(next); // optimistic
    const result = next
      ? await teamService.addFavoriteTeam(teamId)
      : await teamService.removeFavoriteTeam(teamId);
    if (result === null) {
      setIsFavorite(!next); // revert
      Alert.alert(
        'Impossible',
        next
          ? "Impossible d'ajouter ce favori (maximum 3 équipes)."
          : 'Impossible de retirer ce favori.'
      );
    }
    setFavBusy(false);
  }, [isAuthenticated, favBusy, id, isFavorite]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement de l'équipe...</Text>
      </View>
    );
  }

  if (error || !team) {
    return (
      <View style={[styles.container, styles.center]}>
        <MaterialCommunityIcons name="shield-off-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>{error || 'Introuvable'}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const resolvedWiki = team.wiki ?? wikiParam;
  const logo = imageUrl(team.image_url);
  const players = team.players ?? [];
  const sortedPlayers = [...players].sort((a, b) => Number(b.active) - Number(a.active));
  const socialLinks = SOCIAL.map((s) => ({ ...s, url: team.links?.[s.key] })).filter((s) => !!s.url);
  const gameName = team.current_videogame?.name;
  const location = team.region || team.location;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.darkBlue, COLORS.darkest]} style={StyleSheet.absoluteFillObject} />

      {/* Top overlay header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
        </Pressable>
        <Pressable onPress={toggleFavorite} style={styles.iconButton} disabled={favBusy}>
          <MaterialCommunityIcons
            name={isFavorite ? 'star' : 'star-outline'}
            size={24}
            color={isFavorite ? COLORS.tierS : COLORS.text}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── HERO ── */}
        <View style={[styles.hero, { paddingTop: Math.max(insets.top, spacing.sm) + 56 }]}>
          <View style={styles.logoBox}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" />
            ) : (
              <MaterialCommunityIcons name="shield-outline" size={48} color={COLORS.textMuted} />
            )}
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.teamName} numberOfLines={2}>{team.name}</Text>
            {team.acronym && team.acronym !== team.name ? (
              <Text style={styles.acronym}>{team.acronym}</Text>
            ) : null}
          </View>
          {isFavorite && !isSubscribed ? (
            <Pressable onPress={() => router.push('/profile/subscription' as any)} style={styles.premiumHint}>
              <MaterialCommunityIcons name="bell-outline" size={13} color={COLORS.primary} />
              <Text style={styles.premiumHintText}>
                Les notifications de match demandent Premium
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.metaRow}>
            {location ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="map-marker" size={13} color={COLORS.primary} />
                <Text style={styles.metaText}>{location}</Text>
              </View>
            ) : null}
            {gameName ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="gamepad-variant" size={13} color={COLORS.primary} />
                <Text style={styles.metaText}>{gameName}</Text>
              </View>
            ) : null}
            {team.earnings ? (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="trophy" size={13} color={COLORS.tierS} />
                <Text style={[styles.metaText, { color: COLORS.tierS, fontWeight: '800' }]}>{team.earnings}</Text>
              </View>
            ) : null}
          </View>
          {socialLinks.length > 0 ? (
            <View style={styles.socialRow}>
              {socialLinks.map((s) => (
                <Pressable
                  key={s.key}
                  style={({ pressed }) => [styles.socialBtn, pressed && styles.pressed]}
                  onPress={() => Linking.openURL(s.url!)}
                >
                  <MaterialCommunityIcons name={s.icon} size={18} color={COLORS.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* ── ROSTER ── */}
          {sortedPlayers.length > 0 ? (
            <View>
              <SectionHeader icon="account-group" title="Effectif" />
              <View style={styles.card}>
                {sortedPlayers.map((p) => (
                  <PlayerRow key={`${p.id}-${p.name}`} player={p} wiki={resolvedWiki} />
                ))}
              </View>
            </View>
          ) : null}

          {/* ── MATCHES ── */}
          {matches.upcoming.length > 0 ? (
            <View>
              <SectionHeader icon="calendar-clock" title="À venir" />
              {matches.upcoming.map((m) => (
                <LiveMatchCard key={m.match2id || m.id} match={m} fullWidth />
              ))}
            </View>
          ) : null}
          {matches.recent.length > 0 ? (
            <View>
              <SectionHeader icon="history" title="Récents" />
              {matches.recent.map((m) => (
                <LiveMatchCard key={m.match2id || m.id} match={m} fullWidth />
              ))}
            </View>
          ) : null}

          {/* ── PLACEMENTS ── */}
          {placements.length > 0 ? (
            <View>
              <SectionHeader icon="trophy-outline" title="Palmarès" />
              <View style={styles.card}>
                {placements.map((p, i) => (
                  <PlacementRow key={`${p.tournament_page}-${i}`} p={p} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
        <LiquipediaBadge />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  pressed: { opacity: 0.7 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    zIndex: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollContent: { paddingBottom: 60 },
  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: borderRadius.xl,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  logo: { width: 72, height: 72 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  teamName: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  acronym: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  premiumHintText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  premiumHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(242, 46, 98, 0.12)',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  socialRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  socialBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  // Body
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, gap: spacing.xl },
  card: {
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  // Player row
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.darkBlue,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playerAvatarImg: { width: '100%', height: '100%' },
  playerInitials: { color: COLORS.textSecondary, fontWeight: '900', fontSize: 13 },
  playerInfo: { flex: 1, minWidth: 0 },
  playerName: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  formerName: { color: COLORS.textMuted },
  exTag: { color: COLORS.textMuted, fontSize: 9, fontWeight: '900' },
  playerFullName: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  playerMeta: { alignItems: 'flex-end', maxWidth: 100 },
  playerRole: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  playerNat: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  // Placement row
  placementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  placementBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 48 },
  placementText: { fontWeight: '900', fontSize: 14, fontVariant: ['tabular-nums'] },
  placementIconBox: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  placementIcon: { width: 18, height: 18 },
  placementInfo: { flex: 1, minWidth: 0 },
  placementName: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  placementSub: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  placementTier: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  placementPrize: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  placementDate: { color: COLORS.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  // States
  loadingText: { color: COLORS.textSecondary, marginTop: 10, fontWeight: '600' },
  errorText: { color: COLORS.error, fontSize: 16, marginVertical: 20, fontWeight: '700' },
  backLink: { padding: 12, backgroundColor: COLORS.primaryTransparent, borderRadius: 12 },
  backLinkText: { color: COLORS.primary, fontWeight: '800' },
});
