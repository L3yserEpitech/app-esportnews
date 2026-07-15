import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUrl } from '@/utils/imageUrl';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TournamentSectionProps } from './shared';

const formatDate = (dateStr?: string | null): string | null => {
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), 'd MMM yyyy', { locale: fr });
  } catch {
    return null;
  }
};

const tierColor = (tier?: string | null): string => {
  switch (tier?.toLowerCase()) {
    case 's': return COLORS.tier.s;
    case 'a': return COLORS.tier.a;
    case 'b': return COLORS.tier.b;
    case 'c': return COLORS.tier.c;
    default: return COLORS.tier.d;
  }
};

type Status = { label: string; color: string };

const resolveStatus = (tournament: TournamentSectionProps['tournament']): Status | null => {
  if (tournament.status?.toLowerCase() === 'running') {
    return { label: 'EN DIRECT', color: COLORS.live };
  }
  if (!tournament.begin_at) return null;
  const now = new Date();
  const begin = new Date(tournament.begin_at);
  const end = new Date(tournament.end_at || tournament.begin_at);
  if (now < begin) return { label: 'À VENIR', color: COLORS.info };
  if (now > end) return { label: 'TERMINÉ', color: COLORS.textMuted };
  return { label: 'EN DIRECT', color: COLORS.live };
};

export default function TournamentHeader({ tournament }: TournamentSectionProps) {
  const [bannerError, setBannerError] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const status = resolveStatus(tournament);
  const isLive = status?.label === 'EN DIRECT';

  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulseAnim]);

  const bannerUri = imageUrl(tournament.banner_dark_url || tournament.banner_url) ?? undefined;
  const iconUri = imageUrl(tournament.icon_dark_url || tournament.icon_url) ?? undefined;
  const hasBanner = !!bannerUri && !bannerError;

  const beginLabel = formatDate(tournament.begin_at);
  const endLabel = formatDate(tournament.end_at);
  const dateLabel = beginLabel
    ? endLabel && endLabel !== beginLabel ? `${beginLabel} — ${endLabel}` : beginLabel
    : null;

  const StatusPill = status ? (
    <View style={[styles.pill, { backgroundColor: `${status.color}22`, borderColor: `${status.color}55` }]}>
      {isLive && (
        <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
      )}
      <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      {/* Banner */}
      <View style={styles.banner}>
        {hasBanner ? (
          <Image
            source={{ uri: bannerUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            onError={() => setBannerError(true)}
          />
        ) : (
          <LinearGradient
            colors={[COLORS.surfaceVariant, COLORS.surface, COLORS.darkest]}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(6,11,19,0.55)', COLORS.darkest]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          {iconUri ? (
            <View style={styles.iconBox}>
              <Image source={{ uri: iconUri }} style={styles.icon} contentFit="contain" />
            </View>
          ) : null}
          <View style={styles.badges}>
            {tournament.tier ? (
              <View style={[styles.pill, { backgroundColor: `${tierColor(tournament.tier)}26`, borderColor: `${tierColor(tournament.tier)}55` }]}>
                <Text style={[styles.pillText, { color: tierColor(tournament.tier) }]}>
                  {tournament.tier.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {StatusPill}
            {tournament.videogame?.slug ? (
              <View style={[styles.pill, styles.gamePill]}>
                <Text style={[styles.pillText, styles.gamePillText]}>{tournament.videogame.slug}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.name} numberOfLines={3}>{tournament.name}</Text>

        <View style={styles.meta}>
          {tournament.league?.name ? (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="trophy-outline" size={14} color={COLORS.accent} />
              <Text style={styles.metaText} numberOfLines={1}>{tournament.league.name}</Text>
            </View>
          ) : null}
          {dateLabel ? (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="calendar-range" size={14} color={COLORS.accent} />
              <Text style={styles.metaText}>{dateLabel}</Text>
            </View>
          ) : null}
          {tournament.region ? (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="earth" size={14} color={COLORS.accent} />
              <Text style={styles.metaText}>{tournament.region}</Text>
            </View>
          ) : null}
          {tournament.prizepool ? (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="cash-multiple" size={14} color={COLORS.accent} />
              <Text style={[styles.metaText, styles.prizeText]}>{tournament.prizepool}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  banner: {
    height: 160,
    width: '100%',
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  info: {
    paddingHorizontal: spacing.md,
    marginTop: -spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    width: 34,
    height: 34,
  },
  badges: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  gamePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gamePillText: {
    color: COLORS.textSecondary,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.live,
  },
  name: {
    color: COLORS.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  prizeText: {
    color: COLORS.accent,
    fontWeight: '800',
  },
});
