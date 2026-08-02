import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { playerService } from '@/services/playerService';
import { useAdPopup, useSubscription } from '@/hooks';
import { SectionHeader } from '@/components/tournament-detail/sections/shared';
import type { PlayerDetail, PlayerTransfer } from '@/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ── Social links config ───────────────────────────────────────────────────
const SOCIAL: { key: string; icon: IconName; label: string }[] = [
  { key: 'twitter', icon: 'twitter', label: 'X / Twitter' },
  { key: 'youtube', icon: 'youtube', label: 'YouTube' },
  { key: 'twitch', icon: 'twitch', label: 'Twitch' },
  { key: 'instagram', icon: 'instagram', label: 'Instagram' },
  { key: 'tiktok', icon: 'music-note', label: 'TikTok' },
  { key: 'facebook', icon: 'facebook', label: 'Facebook' },
  { key: 'discord', icon: 'message-text', label: 'Discord' },
  { key: 'weibo', icon: 'sina-weibo', label: 'Weibo' },
  { key: 'vk', icon: 'link-variant', label: 'VK' },
];

// ── Role color ────────────────────────────────────────────────────────────
function roleColor(role?: string | null): string {
  if (!role) return COLORS.textSecondary;
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

function formatMoney(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

function formatDate(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Links come from editable wiki content — only allow http(s).
function safeUrl(raw: string): string | null {
  try {
    const p = new URL(raw);
    return p.protocol === 'https:' || p.protocol === 'http:' ? raw : null;
  } catch {
    return null;
  }
}

// ── Transfer row ──────────────────────────────────────────────────────────
function TransferRow({ tr, isLatest, isLast }: { tr: PlayerTransfer; isLatest: boolean; isLast: boolean }) {
  const date = formatDate(tr.date);
  return (
    <View style={[styles.transferRow, !isLast && styles.transferRowBorder, isLatest && styles.transferRowLatest]}>
      <Text style={styles.transferDate}>{date}</Text>
      <View style={styles.transferTeams}>
        {tr.from_team ? (
          <Text style={styles.transferFrom} numberOfLines={1}>{tr.from_team}</Text>
        ) : (
          <Text style={styles.transferStart}>Début de carrière</Text>
        )}
        <MaterialCommunityIcons name="arrow-right" size={14} color={COLORS.textMuted} />
        <Text style={[styles.transferTo, isLatest && styles.transferToLatest]} numberOfLines={1}>
          {tr.to_team || '—'}
        </Text>
      </View>
      {tr.role ? <Text style={styles.transferRole} numberOfLines={1}>{tr.role}</Text> : null}
    </View>
  );
}

export default function PlayerDetailScreen() {
  const { pagename, wiki } = useLocalSearchParams<{ pagename: string; wiki?: string }>();
  const pagenameParam = typeof pagename === 'string' ? pagename : '';
  const wikiParam = typeof wiki === 'string' && wiki.length > 0 ? wiki : undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { isSubscribed } = useSubscription();
  const { showAd } = useAdPopup({ skipIfSubscribed: true, isSubscribed });

  const load = useCallback(async () => {
    // The endpoint requires a wiki (no 10-wiki scan) → treat missing wiki as not-found.
    if (!pagenameParam || !wikiParam) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    const data = await playerService.getPlayer(pagenameParam, wikiParam);
    if (!data) {
      setNotFound(true);
    } else {
      setPlayer(data);
    }
    setLoading(false);
  }, [pagenameParam, wikiParam]);

  useEffect(() => {
    load();
    return () => { showAd(); };
  }, [load, showAd]);

  const earningsYears = useMemo(() => {
    const byYear = player?.earnings_by_year || {};
    const entries = Object.entries(byYear)
      .filter(([, v]) => v > 0)
      .sort(([a], [b]) => a.localeCompare(b));
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return { entries, max };
  }, [player?.earnings_by_year]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du joueur...</Text>
      </View>
    );
  }

  if (notFound || !player) {
    return (
      <View style={[styles.container, styles.center]}>
        <MaterialCommunityIcons name="account-off-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>Joueur introuvable</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const realName = [player.first_name, player.last_name].filter(Boolean).join(' ') || player.name;
  const isActive = player.status?.toLowerCase() === 'active';
  const teamName = player.team_pagename?.replace(/_/g, ' ');
  const roles = player.roles || [];
  const signaturePicks = player.signature_picks || [];

  const socials = SOCIAL
    .map((s) => ({ ...s, url: player.links?.[s.key] ? safeUrl(player.links[s.key]) : null }))
    .filter((s): s is typeof s & { url: string } => s.url !== null);

  const metaBits: { icon: IconName; text: string; accent?: boolean }[] = [];
  if (player.nationalities.length > 0) {
    metaBits.push({ icon: 'map-marker', text: player.nationalities.join(' / ') });
  }
  if (player.region) metaBits.push({ icon: 'earth', text: player.region });
  if (player.age) {
    metaBits.push({ icon: 'calendar', text: `${player.age} ans` });
  } else if (player.birth_date) {
    metaBits.push({ icon: 'calendar', text: formatDate(player.birth_date) });
  }
  if (player.earnings > 0) {
    metaBits.push({ icon: 'trophy', text: formatMoney(player.earnings), accent: true });
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.darkBlue, COLORS.darkest]} style={StyleSheet.absoluteFillObject} />

      {/* Top overlay header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── HERO ── */}
        <View style={[styles.hero, { paddingTop: Math.max(insets.top, spacing.sm) + 56 }]}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarInitials}>{player.id.slice(0, 2).toUpperCase()}</Text>
          </View>

          {/* Status + role pills */}
          {(player.status || roles.length > 0) ? (
            <View style={styles.pillRow}>
              {player.status ? (
                <View style={[styles.pill, isActive ? styles.pillActive : styles.pillMuted]}>
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{player.status}</Text>
                </View>
              ) : null}
              {roles.map((role) => (
                <View key={role} style={styles.pill}>
                  <Text style={[styles.pillText, { color: roleColor(role) }]}>{role}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.playerId} numberOfLines={2}>{player.id}</Text>
          {realName && realName !== player.id ? (
            <Text style={styles.realName} numberOfLines={1}>
              {realName}
              {player.localized_name && player.localized_name !== realName ? (
                <Text style={styles.localizedName}>  ·  {player.localized_name}</Text>
              ) : null}
            </Text>
          ) : null}

          {/* Meta line */}
          {metaBits.length > 0 ? (
            <View style={styles.metaRow}>
              {metaBits.map((m, i) => (
                <View key={i} style={styles.metaItem}>
                  <MaterialCommunityIcons
                    name={m.icon}
                    size={13}
                    color={m.accent ? COLORS.tierS : COLORS.primary}
                  />
                  <Text style={[styles.metaText, m.accent && styles.metaTextAccent]}>{m.text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Current team (non-navigating — a template alone can't resolve a team id) */}
          {teamName ? (
            <View style={styles.teamChip}>
              <MaterialCommunityIcons name="shield-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.teamChipText} numberOfLines={1}>{teamName}</Text>
            </View>
          ) : null}

          {/* Socials */}
          {socials.length > 0 ? (
            <View style={styles.socialRow}>
              {socials.map((s) => (
                <Pressable
                  key={s.key}
                  style={({ pressed }) => [styles.socialBtn, pressed && styles.pressed]}
                  onPress={() => Linking.openURL(s.url)}
                >
                  <MaterialCommunityIcons name={s.icon} size={18} color={COLORS.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* ── SIGNATURE PICKS ── */}
          {signaturePicks.length > 0 ? (
            <View>
              <SectionHeader icon="gamepad-variant" title="Picks signature" />
              <View style={styles.chipWrap}>
                {signaturePicks.map((pick) => (
                  <View key={pick} style={styles.pickChip}>
                    <Text style={styles.pickChipText}>{pick}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── EARNINGS BY YEAR ── */}
          {earningsYears.entries.length > 0 ? (
            <View>
              <SectionHeader
                icon="cash-multiple"
                title="Gains par année"
                extra={<Text style={styles.earningsTotal}>{formatMoney(player.earnings)} total</Text>}
              />
              <View style={styles.card}>
                {earningsYears.entries.map(([year, value]) => (
                  <View key={year} style={styles.earningsRow}>
                    <Text style={styles.earningsYear}>{year}</Text>
                    <View style={styles.earningsTrack}>
                      <View
                        style={[
                          styles.earningsFill,
                          { width: `${Math.max((value / earningsYears.max) * 100, 2)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.earningsValue}>{formatMoney(value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── CAREER / TRANSFERS ── */}
          {player.transfers.length > 0 ? (
            <View>
              <SectionHeader icon="swap-horizontal" title="Parcours" />
              <View style={styles.card}>
                {player.transfers.map((tr, i) => (
                  <TransferRow
                    key={`${tr.date}-${i}`}
                    tr={tr}
                    isLatest={i === 0}
                    isLast={i === player.transfers.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
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
  avatarBox: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.xl,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  avatarInitials: { color: COLORS.textSecondary, fontWeight: '900', fontSize: 30, letterSpacing: 1 },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pillActive: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  pillMuted: {},
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
  },
  pillTextActive: { color: COLORS.success },
  playerId: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  realName: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  localizedName: { color: COLORS.textMuted, fontWeight: '500' },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  metaTextAccent: { color: COLORS.tierS, fontWeight: '800', fontVariant: ['tabular-nums'] },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: spacing.xs,
    maxWidth: '90%',
  },
  teamChipText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pickChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  // Earnings
  earningsTotal: { color: COLORS.primary, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  earningsYear: { width: 40, color: COLORS.textMuted, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  earningsTrack: {
    flex: 1,
    height: 14,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  earningsFill: { height: '100%', borderRadius: borderRadius.full, backgroundColor: COLORS.primary },
  earningsValue: {
    width: 76,
    textAlign: 'right',
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  // Transfers
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  transferRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  transferRowLatest: { backgroundColor: 'rgba(242,46,98,0.04)' },
  transferDate: { width: 74, color: COLORS.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  transferTeams: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  transferFrom: { flexShrink: 1, color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  transferStart: { color: COLORS.textMuted, fontSize: 11, fontStyle: 'italic' },
  transferTo: { flexShrink: 1, color: COLORS.text, fontSize: 13, fontWeight: '800' },
  transferToLatest: { color: COLORS.primary },
  transferRole: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 72,
    textAlign: 'right',
  },
  // States
  loadingText: { color: COLORS.textSecondary, marginTop: 10, fontWeight: '600' },
  errorText: { color: COLORS.error, fontSize: 16, marginVertical: 20, fontWeight: '700' },
  backLink: { padding: 12, backgroundColor: COLORS.primaryTransparent, borderRadius: 12 },
  backLinkText: { color: COLORS.primary, fontWeight: '800' },
});
