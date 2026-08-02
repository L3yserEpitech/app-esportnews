// Mobile bracket — a faithful port of the web TournamentBracket. Every position
// comes from Liquipedia's own topology (`bracketModel`): columns from
// `coordinates.round_index`, vertical order from `match_index_in_round`, and one
// connector per real link. Only declared elimination trees are drawn — Swiss
// rounds and group stages have no tree and live in the match list instead.
// Horizontally scrollable. Self-hides when the tournament has no bracket.
import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { imageUrl } from '@/utils/imageUrl';
import type { PandaMatch } from '@/types';
import { SectionHeader, type TournamentSectionProps } from './shared';
import {
  buildBracketLayout,
  buildGroupColumns,
  columnX,
  CELL_H,
  CELL_W,
  CONNECTOR_W,
  type BracketEdge,
} from '../bracketModel';

const CORNER_R = 5;
const LINE_COLOR = COLORS.primary; // #F22E62

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

function BracketCell({ match, side }: { match: PandaMatch; side: string | null }) {
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
      {side && (
        <View style={styles.sideBadge}>
          <Text style={styles.sideBadgeText}>{side === 'lower' ? 'LB' : 'UB'}</Text>
        </View>
      )}
      <TeamRow team={home} score={homeScore} won={isFinished && match.winner_id === home?.id} live={isLive} />
      <View style={styles.cellDivider} />
      <TeamRow team={away} score={awayScore} won={isFinished && match.winner_id === away?.id} live={isLive} />
    </Pressable>
  );
}

// One path per real parent→child link. Two parents converging on a child give the
// familiar elbow; a single parent (lower-bracket drop-in) gives one line. The
// elbow always turns in the gap right before the child, so a link spanning
// several columns runs straight through at the parent's height.
function edgePath({ fromX, fromY, toX, toY }: BracketEdge): string {
  const vertX = toX - CONNECTOR_W / 2;
  const delta = toY - fromY;
  if (Math.abs(delta) < 1) return `M ${fromX},${fromY} H ${toX}`;

  const dir = delta > 0 ? 1 : -1;
  const cr = Math.min(CORNER_R, Math.abs(delta) / 2);
  return [
    `M ${fromX},${fromY}`,
    `H ${vertX - cr}`,
    `Q ${vertX},${fromY} ${vertX},${fromY + dir * cr}`,
    `V ${toY - dir * cr}`,
    `Q ${vertX},${toY} ${vertX + cr},${toY}`,
    `H ${toX}`,
  ].join(' ');
}

function EdgeOverlay({ edges, width, height }: { edges: BracketEdge[]; width: number; height: number }) {
  const paths = useMemo(() => edges.map(edgePath), [edges]);
  if (paths.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        {paths.map((d, i) => (
          <Path key={`glow-${i}`} d={d} stroke={LINE_COLOR} strokeWidth={6} strokeOpacity={0.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {paths.map((d, i) => (
          <Path key={`line-${i}`} d={d} stroke={LINE_COLOR} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    </View>
  );
}

function RoundPill({ text }: { text: string }) {
  return (
    <View style={styles.roundLabel}>
      <Text style={styles.roundLabelText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

export default function BracketSection({ matches }: TournamentSectionProps) {
  const groups = useMemo(() => buildGroupColumns(matches), [matches]);
  const layout = useMemo(() => buildBracketLayout(matches), [matches]);
  if (groups.length === 0 && layout.columns.length === 0) return null;

  // Sub-headings only earn their place when both blocks are on screen.
  const bothBlocks = groups.length > 0 && layout.columns.length > 0;

  return (
    <View>
      <SectionHeader icon="tournament" title="Bracket" />

      {/* Group / Swiss rounds: plain columns, stacked above the tree */}
      {groups.length > 0 && (
        <View style={styles.block}>
          {bothBlocks && <Text style={styles.blockHeading}>Phase de groupes</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={styles.groupRow}>
              {groups.map(col => (
                <View key={col.key} style={styles.groupColumn}>
                  <RoundPill text={col.label} />
                  {col.matches.map(match => (
                    <BracketCell key={match.match2id || match.id} match={match} side={null} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Elimination tree */}
      {layout.columns.length > 0 && (
        <View style={styles.block}>
          {bothBlocks && <Text style={styles.blockHeading}>Phase finale</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View>
              <View style={styles.labelsRow}>
                {layout.columns.map((col, colIdx) => (
                  <React.Fragment key={`label-${col.key}`}>
                    {colIdx > 0 && <View style={styles.connectorSpacer} />}
                    <View style={styles.labelSlot}>
                      <RoundPill text={col.label} />
                    </View>
                  </React.Fragment>
                ))}
              </View>

              <View style={{ width: layout.width, height: layout.height }}>
                <EdgeOverlay edges={layout.edges} width={layout.width} height={layout.height} />

                {layout.columns.map((col, colIdx) => (
                  <View
                    key={`col-${col.key}`}
                    style={[styles.column, { left: columnX(colIdx), height: layout.height }]}
                  >
                    {col.startsStage && <View style={styles.stageDivider} />}
                    {col.cells.map(cell => (
                      <View
                        key={cell.match.match2id || cell.match.id}
                        style={[styles.cellSlot, { top: cell.centerY - CELL_H / 2 }]}
                      >
                        <BracketCell match={cell.match} side={cell.side} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.sm, paddingRight: spacing.md },
  block: { marginBottom: spacing.sm },
  blockHeading: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  groupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  groupColumn: { width: CELL_W, alignItems: 'center', gap: spacing.sm },
  labelsRow: { flexDirection: 'row', marginBottom: spacing.sm },
  labelSlot: { width: CELL_W, alignItems: 'center' },
  connectorSpacer: { width: CONNECTOR_W },
  column: { position: 'absolute', top: 0, width: CELL_W },
  cellSlot: { position: 'absolute', left: 0, width: CELL_W, height: CELL_H },
  stageDivider: {
    position: 'absolute',
    top: 0,
    left: -CONNECTOR_W / 2,
    width: StyleSheet.hairlineWidth,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
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
  sideBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 1,
    paddingHorizontal: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(6,11,19,0.8)',
  },
  sideBadgeText: { fontSize: 7, fontWeight: '700', letterSpacing: 0.5, color: COLORS.textSecondary },
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
