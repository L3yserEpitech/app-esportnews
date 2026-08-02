import type { PandaMatch } from '../../types';

// ─── Layout constants ────────────────────────────────────────────────
export const CELL_H = 58;         // match cell height (px)
export const GAP = 16;            // min vertical gap between two cells
export const SLOT = CELL_H + GAP; // vertical pitch of an unlinked column
export const CELL_W = 208;        // match cell width
export const CONNECTOR_W = 56;    // width of the gap between two columns

// ─── Public shape ────────────────────────────────────────────────────

/** A column header. `raw` comes straight from Liquipedia, `i18n` is derived. */
export type ColumnLabel =
  | { kind: 'raw'; text: string }
  | { kind: 'i18n'; key: string; round?: number };

export interface PositionedCell {
  match: PandaMatch;
  centerY: number;
  /** 'upper' | 'lower', only on double-elimination stages — null otherwise. */
  side: string | null;
}

/**
 * One real parent→child link, in absolute canvas coordinates. A link can span
 * more than one column: in double elimination the upper-bracket final is drawn
 * level with the lower-bracket final, two rounds right of the matches feeding it.
 */
export interface BracketEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface BracketColumn {
  key: string;
  label: ColumnLabel;
  cells: PositionedCell[];
  /** First column of a new stage: render a divider in the gap before it. */
  startsStage: boolean;
}

export interface BracketLayout {
  columns: BracketColumn[];
  /** Drawn as one overlay on top of the whole grid, so links may span columns. */
  edges: BracketEdge[];
  width: number;
  height: number;
}

/** Left offset of a column on the canvas. */
export function columnX(index: number): number {
  return index * (CELL_W + CONNECTOR_W);
}

// ─── Section ordering (fallback for matches without bracket_data) ────

const SECTION_ORDER: Record<string, number> = {
  'round 1': 0, 'round of 64': 1, 'round of 32': 2, 'round of 16': 3,
  'round of 12': 3, 'round of 8': 4,
  'quarterfinals': 5, 'quarter-finals': 5,
  'semifinals': 6, 'semi-finals': 6,
  'lower bracket round 1': 1, 'lower bracket round 2': 2,
  'lower bracket round 3': 3, 'lower bracket round 4': 4,
  'lower bracket round 5': 5, 'lower bracket quarterfinals': 5,
  'lower bracket semi-finals': 6, 'lower bracket semifinals': 6,
  'lower bracket final': 7,
  'upper bracket round 1': 1, 'upper bracket round 2': 2,
  'upper bracket quarterfinals': 5, 'upper bracket semi-finals': 6,
  'upper bracket semifinals': 6, 'upper bracket final': 7,
  'grand final': 8, 'grand finals': 8, 'finals': 8, 'final': 8,
  'third place match': 7, '3rd place match': 7,
};

function getSectionOrder(section: string): number {
  const lower = section.toLowerCase().trim();
  if (SECTION_ORDER[lower] !== undefined) return SECTION_ORDER[lower];
  const m = lower.match(/round\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 50;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function matchKey(m: PandaMatch): string {
  return m.match2id || String(m.id);
}

function isTree(m: PandaMatch): boolean {
  return m.bracket_data?.type === 'bracket' && !!m.bracket_data.coordinates;
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

/**
 * Round name derived from the distance to the final, which is stable whatever
 * the column's match count (a stray third-place match won't rename a round).
 * Double-elimination columns mix upper and lower rounds, so they stay numeric.
 */
function treeColumnLabel(roundIndex: number, roundCount: number, sectionCount: number): ColumnLabel {
  if (sectionCount > 1) return { kind: 'i18n', key: 'bracket_round', round: roundIndex + 1 };
  switch (roundCount - 1 - roundIndex) {
    case 0: return { kind: 'i18n', key: 'bracket_final' };
    case 1: return { kind: 'i18n', key: 'bracket_semifinals' };
    case 2: return { kind: 'i18n', key: 'bracket_quarterfinals' };
    case 3: return { kind: 'i18n', key: 'bracket_round_of_16' };
    case 4: return { kind: 'i18n', key: 'bracket_round_of_32' };
    case 5: return { kind: 'i18n', key: 'bracket_round_of_64' };
    default: return { kind: 'i18n', key: 'bracket_round', round: roundIndex + 1 };
  }
}

/**
 * Fill the gaps left by cells whose parents are unknown (unplayed drop-in slots),
 * then push cells apart so a collapsed average never overlaps two boxes.
 */
function settle(resolved: (number | null)[]): number[] {
  const n = resolved.length;
  const out = resolved.map((v, i) => {
    if (v !== null) return v;
    let p = i - 1;
    while (p >= 0 && resolved[p] === null) p--;
    let q = i + 1;
    while (q < n && resolved[q] === null) q++;
    if (p >= 0 && q < n) return resolved[p]! + ((resolved[q]! - resolved[p]!) * (i - p)) / (q - p);
    if (p >= 0) return resolved[p]! + (i - p) * SLOT;
    if (q < n) return resolved[q]! - (q - i) * SLOT;
    return (i + 0.5) * SLOT;
  });

  out[0] = Math.max(out[0], SLOT / 2);
  for (let i = 1; i < n; i++) out[i] = Math.max(out[i], out[i - 1] + SLOT);
  return out;
}

// ─── Layout builder ──────────────────────────────────────────────────

interface Stage {
  order: number;
  columns: BracketColumn[];
}

/**
 * Positions every match from Liquipedia's own bracket topology: columns come
 * from `coordinates.round_index`, vertical order from `match_index_in_round`,
 * and a child sits at the average height of the matches that actually feed it.
 * Rounds that are not trees (Swiss, groups) get columns but never connectors.
 */
export function buildBracketLayout(matches: PandaMatch[]): BracketLayout {
  const seen = new Set<string>();
  const deduped: PandaMatch[] = [];
  for (const m of matches) {
    const k = matchKey(m);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(m);
  }

  const trees = new Map<string, PandaMatch[]>();
  const lists = new Map<string, PandaMatch[]>();
  for (const m of deduped) {
    if (isTree(m) && m.match2bracketid) push(trees, m.match2bracketid, m);
    else if (m.section) push(lists, m.section, m);
  }

  const stages: Stage[] = [];
  const yById = new Map<string, number>();

  // ── Non-tree rounds: one column per Liquipedia section, no connectors ──
  if (lists.size > 0) {
    const columns = [...lists.entries()]
      .map(([section, group]) => ({
        section,
        group,
        order: sortKey(group, () => 1000 + getSectionOrder(section)),
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ section, group }): BracketColumn => {
        const sorted = [...group].sort(
          (a, b) =>
            (a.bracket_data?.bracket_index ?? 0) - (b.bracket_data?.bracket_index ?? 0) ||
            (a.bracket_data?.match_index ?? 0) - (b.bracket_data?.match_index ?? 0) ||
            String(a.begin_at ?? '').localeCompare(String(b.begin_at ?? '')),
        );
        return {
          key: `list:${section}`,
          label: { kind: 'raw', text: section },
          cells: sorted.map((match, i) => ({
            match,
            centerY: (i + 0.5) * SLOT,
            side: null,
          })),
          startsStage: false,
        };
      });

    stages.push({
      order: sortKey([...lists.values()].flat(), () => 1000),
      columns,
    });
  }

  // ── Real elimination trees ──
  for (const [bracketId, group] of trees) {
    const roundIndexes = [...new Set(group.map(m => m.bracket_data!.coordinates!.round_index))].sort(
      (a, b) => a - b,
    );
    const roundCount = Math.max(...group.map(m => m.bracket_data!.coordinates!.round_count), roundIndexes.length);
    const sectionCount = Math.max(...group.map(m => m.bracket_data!.coordinates!.section_count), 1);

    const columns: BracketColumn[] = [];

    for (const roundIndex of roundIndexes) {
      const cellMatches = group
        .filter(m => m.bracket_data!.coordinates!.round_index === roundIndex)
        .sort(
          (a, b) =>
            a.bracket_data!.coordinates!.match_index_in_round -
            b.bracket_data!.coordinates!.match_index_in_round,
        );

      const centers = settle(
        cellMatches.map(m => {
          const known = (m.bracket_data!.lower_match_ids ?? []).filter(id => yById.has(id));
          return known.length ? known.reduce((sum, id) => sum + yById.get(id)!, 0) / known.length : null;
        }),
      );
      cellMatches.forEach((m, i) => yById.set(matchKey(m), centers[i]));

      columns.push({
        key: `${bracketId}:${roundIndex}`,
        label: treeColumnLabel(roundIndex, roundCount, sectionCount),
        cells: cellMatches.map((match, i) => ({
          match,
          centerY: centers[i],
          side: sectionCount > 1 ? match.bracket_data!.bracket_section ?? null : null,
        })),
        startsStage: false,
      });
    }

    stages.push({ order: sortKey(group, () => 2000), columns });
  }

  stages.sort((a, b) => a.order - b.order);

  const columns: BracketColumn[] = [];
  stages.forEach((stage, si) => {
    stage.columns.forEach((col, ci) => {
      columns.push({ ...col, startsStage: si > 0 && ci === 0 });
    });
  });

  // Edges need every column's final index, so they are resolved once the stages
  // are flattened — a parent may sit more than one column to the left.
  const placement = new Map<string, { column: number; centerY: number }>();
  columns.forEach((col, index) => {
    for (const cell of col.cells) placement.set(matchKey(cell.match), { column: index, centerY: cell.centerY });
  });

  const edges: BracketEdge[] = [];
  columns.forEach((col, index) => {
    for (const cell of col.cells) {
      for (const id of cell.match.bracket_data?.lower_match_ids ?? []) {
        const parent = placement.get(id);
        if (!parent || parent.column >= index) continue;
        edges.push({
          fromX: columnX(parent.column) + CELL_W,
          fromY: parent.centerY,
          toX: columnX(index),
          toY: cell.centerY,
        });
      }
    }
  });

  const height = columns.reduce(
    (max, col) => col.cells.reduce((m, c) => Math.max(m, c.centerY + CELL_H / 2), max),
    SLOT,
  );
  const width = columns.length === 0 ? 0 : columnX(columns.length - 1) + CELL_W;

  return { columns, edges, width, height };
}

/** Lowest Liquipedia bracket_index in a group — the page's own left-to-right order. */
function sortKey(group: PandaMatch[], fallback: () => number): number {
  const indexes = group
    .map(m => m.bracket_data?.bracket_index)
    .filter((v): v is number => typeof v === 'number');
  return indexes.length ? Math.min(...indexes) : fallback();
}
