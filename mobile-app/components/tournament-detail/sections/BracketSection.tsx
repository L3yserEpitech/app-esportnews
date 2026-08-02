// Mobile 2-D bracket tree — a faithful port of the web TournamentBracket. Round
// columns laid left→right in bracket order, each match cell converging into the
// next round through an SVG elbow connector (with a soft accent glow), the whole
// thing horizontally scrollable. Works purely off the enriched `matches` prop —
// no fetch. Self-hides when no match carries a section.
import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Svg, { Path, Line } from 'react-native-svg';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { imageUrl } from '@/utils/imageUrl';
import type { PandaMatch } from '@/types';
import { SectionHeader, type TournamentSectionProps } from './shared';

// ─── Layout constants ────────────────────────────────────────────────
const CELL_H = 56;                 // match cell height
const GAP = 16;                    // min vertical gap between first-round cells
const SLOT = CELL_H + GAP;         // first-round slot height
const CELL_W = 196;                // match cell width
const CONNECTOR_W = 44;            // SVG connector width between columns
const CORNER_R = 5;                // rounded corner radius on bracket lines
const LINE_COLOR = COLORS.primary; // #F22E62

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

function BracketCell({ match }: { match: PandaMatch }) {
  const router = useRouter();
  const home = match.opponents?.[0]?.opponent;
  const away = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === home?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === away?.id)?.score;
  const isLive = match.status === 'running';
  const isFinished = match.status === 'finished';

  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: String(match.id), m2: match.match2id ?? '', wiki: match.wiki ?? '' } })}
    >
      {isLive && <View style={styles.liveBar} />}
      <TeamRow team={home} score={homeScore} won={isFinished && match.winner_id === home?.id} live={isLive} />
      <View style={styles.cellDivider} />
      <TeamRow team={away} score={awayScore} won={isFinished && match.winner_id === away?.id} live={isLive} />
    </Pressable>
  );
}

// Build the "⊐" path (with rounded corners) that joins a pair of source-round
// cells into their child cell in the next round.
function bracketPath(topY: number, botY: number, midY: number, vertX: number, r: number): string {
  const cr = Math.min(r, (botY - topY) / 2);
  return [
    `M 0,${topY}`,
    `H ${vertX - cr}`,
    `Q ${vertX},${topY} ${vertX},${topY + cr}`,
    `V ${midY}`,
    `H ${CONNECTOR_W}`,
    `M ${vertX},${midY}`,
    `V ${botY - cr}`,
    `Q ${vertX},${botY} ${vertX - cr},${botY}`,
    `H 0`,
  ].join(' ');
}

function SVGConnector({ prevCount, nextCount, totalHeight }: {
  prevCount: number; nextCount: number; totalHeight: number;
}) {
  const prevSlot = totalHeight / prevCount;
  const isPerfect = prevCount === 2 * nextCount;

  // Non-standard column progression (e.g. group→single-match): straight lines.
  if (!isPerfect) {
    const n = Math.min(prevCount, nextCount);
    return (
      <Svg width={CONNECTOR_W} height={totalHeight}>
        {Array.from({ length: n }).map((_, i) => {
          const y = (i + 0.5) * (totalHeight / n);
          return <Line key={i} x1={0} y1={y} x2={CONNECTOR_W} y2={y} stroke={LINE_COLOR} strokeWidth={2} strokeOpacity={0.25} />;
        })}
      </Svg>
    );
  }

  const vertX = CONNECTOR_W / 2;
  const paths = Array.from({ length: nextCount }).map((_, j) => {
    const topY = (2 * j + 0.5) * prevSlot;
    const botY = (2 * j + 1.5) * prevSlot;
    return bracketPath(topY, botY, (topY + botY) / 2, vertX, CORNER_R);
  });

  return (
    <Svg width={CONNECTOR_W} height={totalHeight}>
      {paths.map((d, j) => (
        <Path key={`glow-${j}`} d={d} stroke={LINE_COLOR} strokeWidth={6} strokeOpacity={0.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {paths.map((d, j) => (
        <Path key={`line-${j}`} d={d} stroke={LINE_COLOR} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

export default function BracketSection({ matches }: TournamentSectionProps) {
  const sections = useMemo(() => groupAndSortSections(matches), [matches]);
  if (sections.length === 0) return null;

  // Drive the tree height off the busiest column so no column is ever cramped
  // (some tournaments have a later round with MORE matches than the first, e.g.
  // a "Playoffs" catch-all). Every column then gets a slot ≥ one full cell.
  const maxCount = Math.max(...sections.map(s => s.matches.length));
  const totalHeight = maxCount * SLOT;

  return (
    <View>
      <SectionHeader icon="tournament" title="Bracket" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View>
          {/* Round labels row */}
          <View style={styles.labelsRow}>
            {sections.map((group, colIdx) => (
              <React.Fragment key={`label-${group.section}`}>
                <View style={styles.labelSlot}>
                  <View style={styles.roundLabel}>
                    <Text style={styles.roundLabelText} numberOfLines={1}>{group.section}</Text>
                  </View>
                </View>
                {colIdx < sections.length - 1 && <View style={styles.connectorSpacer} />}
              </React.Fragment>
            ))}
          </View>

          {/* Bracket tree */}
          <View style={[styles.treeRow, { height: totalHeight }]}>
            {sections.map((group, colIdx) => {
              const slotH = totalHeight / group.matches.length;
              return (
                <React.Fragment key={`col-${group.section}`}>
                  <View style={[styles.column, { height: totalHeight }]}>
                    {group.matches.map(match => (
                      <View key={match.match2id || match.id} style={[styles.cellSlot, { height: slotH }]}>
                        <BracketCell match={match} />
                      </View>
                    ))}
                  </View>
                  {colIdx < sections.length - 1 && (
                    <SVGConnector
                      prevCount={group.matches.length}
                      nextCount={sections[colIdx + 1].matches.length}
                      totalHeight={totalHeight}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.sm, paddingRight: spacing.md },
  labelsRow: { flexDirection: 'row', marginBottom: spacing.sm },
  labelSlot: { width: CELL_W, alignItems: 'center' },
  connectorSpacer: { width: CONNECTOR_W },
  treeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { width: CELL_W },
  cellSlot: { alignItems: 'center', justifyContent: 'center' },
  roundLabel: {
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
    width: CELL_W,
    height: CELL_H,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cellPressed: { borderColor: COLORS.primary, opacity: 0.9 },
  liveBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: COLORS.primary },
  cellDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)' },
  teamRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
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
