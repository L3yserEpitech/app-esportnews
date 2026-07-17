// Mobile-adapted bracket: the web draws a 2-D tree with SVG connectors; on a
// narrow screen we render horizontally-scrollable round columns (one per
// `section`), each a vertical list of compact match cells. Works purely off the
// enriched `matches` prop — no fetch. Self-hides when no match carries a section.
import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { imageUrl } from '@/utils/imageUrl';
import type { PandaMatch } from '@/types';
import { SectionHeader, type TournamentSectionProps } from './shared';

const CELL_W = 210;

const SECTION_ORDER: Record<string, number> = {
  'round 1': 0, 'round of 64': 1, 'round of 32': 2, 'round of 16': 3,
  'round of 12': 3, 'round of 8': 4,
  quarterfinals: 5, 'quarter-finals': 5,
  semifinals: 6, 'semi-finals': 6,
  'lower bracket round 1': 1, 'lower bracket round 2': 2,
  'lower bracket round 3': 3, 'lower bracket round 4': 4,
  'lower bracket round 5': 5, 'lower bracket quarterfinals': 5,
  'lower bracket semi-finals': 6, 'lower bracket semifinals': 6,
  'lower bracket final': 7,
  'upper bracket round 1': 1, 'upper bracket round 2': 2,
  'upper bracket quarterfinals': 5, 'upper bracket semi-finals': 6,
  'upper bracket semifinals': 6, 'upper bracket final': 7,
  'grand final': 8, 'grand finals': 8, finals: 8, final: 8,
  'third place match': 7, '3rd place match': 7,
};

function getSectionOrder(section: string): number {
  const lower = section.toLowerCase().trim();
  if (SECTION_ORDER[lower] !== undefined) return SECTION_ORDER[lower];
  const m = lower.match(/round\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 50;
}

function groupAndSortSections(matches: PandaMatch[]) {
  const groups = new Map<string, PandaMatch[]>();
  const order: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const s = m.section || '';
    if (!s) continue;
    const key = m.match2id || String(m.id);
    if (seen.has(key)) continue; // guard against repeated match entries
    seen.add(key);
    if (!groups.has(s)) {
      groups.set(s, []);
      order.push(s);
    }
    groups.get(s)!.push(m);
  }
  order.sort((a, b) => getSectionOrder(a) - getSectionOrder(b));
  return order.map(s => ({ section: s, matches: groups.get(s)! }));
}

function TeamRow({ team, score, won, live }: {
  team?: { id: number; name: string; acronym?: string | null; image_url?: string | null } | null;
  score?: number;
  won: boolean;
  live: boolean;
}) {
  const logo = imageUrl(team?.image_url);
  return (
    <View style={[styles.teamRow, won && styles.teamRowWon]}>
      <View style={styles.logoBox}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" />
        ) : (
          <Text style={styles.logoFallback}>{team?.name?.slice(0, 2).toUpperCase() || '?'}</Text>
        )}
      </View>
      <Text style={[styles.teamName, won && styles.teamNameWon]} numberOfLines={1}>
        {team?.name || 'TBD'}
      </Text>
      <Text style={[styles.score, live && styles.scoreLive, won && styles.scoreWon]}>
        {score !== undefined ? score : '-'}
      </Text>
    </View>
  );
}

function BracketCell({ match, full }: { match: PandaMatch; full?: boolean }) {
  const router = useRouter();
  const home = match.opponents?.[0]?.opponent;
  const away = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === home?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === away?.id)?.score;
  const isLive = match.status === 'running';
  const isFinished = match.status === 'finished';

  return (
    <Pressable
      style={({ pressed }) => [styles.cell, full ? styles.cellFull : styles.cellFixed, pressed && styles.cellPressed]}
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: String(match.id), m2: match.match2id ?? '', wiki: match.wiki ?? '' } })}
    >
      {isLive && <View style={styles.liveBar} />}
      <TeamRow team={home} score={homeScore} won={isFinished && match.winner_id === home?.id} live={isLive} />
      <View style={styles.cellDivider} />
      <TeamRow team={away} score={awayScore} won={isFinished && match.winner_id === away?.id} live={isLive} />
    </Pressable>
  );
}

export default function BracketSection({ matches }: TournamentSectionProps) {
  const sections = useMemo(() => groupAndSortSections(matches), [matches]);
  if (sections.length === 0) return null;

  // A single round isn't a tree — render full-width cells (no dead space on the
  // right). Only a real multi-round bracket gets the horizontal-scroll columns.
  const single = sections.length === 1;

  return (
    <View>
      <SectionHeader icon="tournament" title="Bracket" />
      {single ? (
        <View style={styles.singleColumn}>
          <View style={styles.roundLabel}>
            <Text style={styles.roundLabelText} numberOfLines={1}>{sections[0].section}</Text>
          </View>
          {sections[0].matches.map(match => (
            <BracketCell key={match.match2id || match.id} match={match} full />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns}>
          {sections.map(group => (
            <View key={group.section} style={styles.column}>
              <View style={styles.roundLabel}>
                <Text style={styles.roundLabelText} numberOfLines={1}>{group.section}</Text>
              </View>
              {group.matches.map(match => (
                <BracketCell key={match.match2id || match.id} match={match} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  singleColumn: { gap: spacing.md },
  columns: { gap: spacing.md, paddingBottom: spacing.sm },
  column: { gap: spacing.md },
  roundLabel: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  roundLabelText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cell: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  cellFixed: { width: CELL_W },
  cellFull: { width: '100%' },
  cellPressed: { borderColor: COLORS.primary, opacity: 0.9 },
  liveBar: { height: 2, backgroundColor: COLORS.primary, width: '100%' },
  cellDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)' },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  teamRowWon: { backgroundColor: 'rgba(242,46,98,0.08)' },
  logoBox: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 16, height: 16 },
  logoFallback: { fontSize: 7, fontWeight: '700', color: COLORS.textSecondary },
  teamName: { flex: 1, fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  teamNameWon: { color: COLORS.text, fontWeight: '700' },
  score: { width: 18, textAlign: 'right', fontSize: 12, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
  scoreLive: { color: COLORS.primary, fontWeight: '700' },
  scoreWon: { color: COLORS.text, fontWeight: '700' },
});
