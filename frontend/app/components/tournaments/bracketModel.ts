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
  /** Nothing feeds this column from the left: render a divider before it. */
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

/** Opponent ids are hashes of the team name, so they are stable across matches. */
function participantIds(m: PandaMatch): number[] {
  return (m.opponents ?? [])
    .map(o => o.opponent?.id)
    .filter((v): v is number => typeof v === 'number');
}

/** Lowest Liquipedia bracket_index in a group — the page's own left-to-right order. */
function sortKey(group: PandaMatch[], fallback: () => number): number {
  const indexes = group
    .map(m => m.bracket_data?.bracket_index)
    .filter((v): v is number => typeof v === 'number');
  return indexes.length ? Math.min(...indexes) : fallback();
}

/**
 * Round name from the distance to the end of its connected chain. Derived from
 * the chain rather than `coordinates.round_count`, because a bracket authored as
 * one mini-bracket per round reports round_count = 1 on every single match.
 * Double-elimination columns mix upper and lower rounds, so they stay numeric.
 */
function treeColumnLabel(fromEnd: number, indexInChain: number, doubleElim: boolean): ColumnLabel {
  if (doubleElim) return { kind: 'i18n', key: 'bracket_round', round: indexInChain + 1 };
  switch (fromEnd) {
    case 0: return { kind: 'i18n', key: 'bracket_final' };
    case 1: return { kind: 'i18n', key: 'bracket_semifinals' };
    case 2: return { kind: 'i18n', key: 'bracket_quarterfinals' };
    case 3: return { kind: 'i18n', key: 'bracket_round_of_16' };
    case 4: return { kind: 'i18n', key: 'bracket_round_of_32' };
    case 5: return { kind: 'i18n', key: 'bracket_round_of_64' };
    default: return { kind: 'i18n', key: 'bracket_round', round: indexInChain + 1 };
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

interface RawColumn {
  key: string;
  tree: boolean;
  section: string | null;
  doubleElim: boolean;
  /** First column of a Liquipedia stage, before we know what actually feeds it. */
  stageFirst: boolean;
  cells: PandaMatch[];
}

/**
 * Positions every match from Liquipedia's own bracket topology: columns come
 * from `coordinates.round_index`, vertical order from `match_index_in_round`,
 * and a child sits at the average height of the matches that actually feed it.
 * Rounds that are not trees (Swiss, groups) get columns but never connectors.
 */
export function buildBracketLayout(matches: PandaMatch[]): BracketLayout {
  const columns = buildColumns(matches);
  if (columns.length === 0) return { columns: [], edges: [], width: 0, height: 0 };

  const parents = linkColumns(columns);
  reorderForPlanarity(columns, parents);

  const yById = new Map<string, number>();
  const positioned: PositionedCell[][] = columns.map(col => {
    const centers = settle(
      col.cells.map(m => {
        const known = (parents.get(matchKey(m)) ?? []).filter(id => yById.has(id));
        return known.length ? known.reduce((sum, id) => sum + yById.get(id)!, 0) / known.length : null;
      }),
    );
    col.cells.forEach((m, i) => yById.set(matchKey(m), centers[i]));
    return col.cells.map((match, i) => ({
      match,
      centerY: centers[i],
      side: col.doubleElim ? match.bracket_data?.bracket_section ?? null : null,
    }));
  });

  const placement = new Map<string, { column: number; centerY: number }>();
  positioned.forEach((cells, index) => {
    for (const cell of cells) placement.set(matchKey(cell.match), { column: index, centerY: cell.centerY });
  });

  const edges: BracketEdge[] = [];
  const fed = new Set<number>();
  positioned.forEach((cells, index) => {
    for (const cell of cells) {
      for (const id of parents.get(matchKey(cell.match)) ?? []) {
        const parent = placement.get(id);
        if (!parent || parent.column >= index) continue;
        fed.add(index);
        edges.push({
          fromX: columnX(parent.column) + CELL_W,
          fromY: parent.centerY,
          toX: columnX(index),
          toY: cell.centerY,
        });
      }
    }
  });

  const labels = columnLabels(columns, fed);
  const height = positioned.reduce(
    (max, cells) => cells.reduce((m, c) => Math.max(m, c.centerY + CELL_H / 2), max),
    SLOT,
  );

  return {
    columns: columns.map((col, i) => ({
      key: col.key,
      label: labels[i],
      cells: positioned[i],
      // A stage that turned out to be fed by the previous column is not a new stage.
      startsStage: i > 0 && col.stageFirst && !fed.has(i),
    })),
    edges,
    width: columnX(columns.length - 1) + CELL_W,
    height,
  };
}

/** Group matches into ordered columns: non-tree sections first, then each tree. */
function buildColumns(matches: PandaMatch[]): RawColumn[] {
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

  const stages: { order: number; columns: RawColumn[] }[] = [];

  if (lists.size > 0) {
    const columns = [...lists.entries()]
      .map(([section, group]) => ({
        section,
        group,
        order: sortKey(group, () => 1000 + getSectionOrder(section)),
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ section, group }): RawColumn => ({
        key: `list:${section}`,
        tree: false,
        section,
        doubleElim: false,
        stageFirst: false,
        cells: [...group].sort(
          (a, b) =>
            (a.bracket_data?.bracket_index ?? 0) - (b.bracket_data?.bracket_index ?? 0) ||
            (a.bracket_data?.match_index ?? 0) - (b.bracket_data?.match_index ?? 0) ||
            String(a.begin_at ?? '').localeCompare(String(b.begin_at ?? '')),
        ),
      }));
    stages.push({ order: sortKey([...lists.values()].flat(), () => 1000), columns });
  }

  for (const [bracketId, group] of trees) {
    const doubleElim = Math.max(...group.map(m => m.bracket_data!.coordinates!.section_count), 1) > 1;
    const roundIndexes = [...new Set(group.map(m => m.bracket_data!.coordinates!.round_index))].sort(
      (a, b) => a - b,
    );

    stages.push({
      order: sortKey(group, () => 2000),
      columns: roundIndexes.map(roundIndex => ({
        key: `${bracketId}:${roundIndex}`,
        tree: true,
        section: null,
        doubleElim,
        stageFirst: roundIndex === roundIndexes[0],
        cells: group
          .filter(m => m.bracket_data!.coordinates!.round_index === roundIndex)
          .sort(
            (a, b) =>
              a.bracket_data!.coordinates!.match_index_in_round -
              b.bracket_data!.coordinates!.match_index_in_round,
          ),
      })),
    });
  }

  stages.sort((a, b) => a.order - b.order);
  return stages.flatMap(s => s.columns);
}

/**
 * Resolve which matches feed which. `lower_match_ids` is authoritative when the
 * bracket is authored as a single template, but a bracket split into one
 * mini-bracket per round — common on BLAST and IEM pages — declares nothing at
 * all. There, fall back to the winners themselves: a match is fed by the previous
 * column's matches whose winner plays in it.
 *
 * Never infer from position. Real brackets pair across the column (quarterfinal 1
 * and 3 meet in semifinal 1), so `2j / 2j+1` index arithmetic would silently
 * invent the wrong tree — which is the bug this whole model exists to kill.
 */
function linkColumns(columns: RawColumn[]): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  const columnOf = new Map<string, number>();
  columns.forEach((col, i) => col.cells.forEach(m => columnOf.set(matchKey(m), i)));

  columns.forEach((col, i) => {
    if (!col.tree || i === 0) return;

    let declaredAny = false;
    for (const m of col.cells) {
      const declared = (m.bracket_data?.lower_match_ids ?? []).filter(id => {
        const at = columnOf.get(id);
        return at !== undefined && at < i;
      });
      if (declared.length) {
        parents.set(matchKey(m), declared);
        declaredAny = true;
      }
    }
    if (declaredAny) return;

    const previous = columns[i - 1];
    if (!previous.tree) return;

    const winnerToMatch = new Map<number, string>();
    for (const m of previous.cells) {
      if (typeof m.winner_id === 'number') winnerToMatch.set(m.winner_id, matchKey(m));
    }

    for (const m of col.cells) {
      const derived = participantIds(m)
        .map(id => winnerToMatch.get(id))
        .filter((v): v is string => v !== undefined);
      if (derived.length) parents.set(matchKey(m), derived);
    }
  });

  return parents;
}

/**
 * Reorder a column so its cells sit next to the child they feed, keeping the
 * connectors from crossing. Only applied when every cell in the column has a
 * known child: mid-tournament half the links are still missing, and reshuffling
 * on every result would make the bracket jump around between refreshes.
 */
function reorderForPlanarity(columns: RawColumn[], parents: Map<string, string[]>) {
  for (let i = columns.length - 2; i >= 0; i--) {
    const col = columns[i];
    if (!col.tree || !columns[i + 1].tree) continue;

    const childIndex = new Map<string, number>();
    columns[i + 1].cells.forEach((child, j) => {
      for (const id of parents.get(matchKey(child)) ?? []) childIndex.set(id, j);
    });
    if (col.cells.some(m => !childIndex.has(matchKey(m)))) continue;

    const original = new Map(col.cells.map((m, idx) => [matchKey(m), idx]));
    col.cells.sort(
      (a, b) =>
        childIndex.get(matchKey(a))! - childIndex.get(matchKey(b))! ||
        original.get(matchKey(a))! - original.get(matchKey(b))!,
    );
  }
}

/** Name tree columns from their position in the chain of columns that feed each other. */
function columnLabels(columns: RawColumn[], fed: Set<number>): ColumnLabel[] {
  const chainEnd: number[] = [];
  for (let i = columns.length - 1; i >= 0; i--) {
    chainEnd[i] = columns[i].tree && i + 1 < columns.length && columns[i + 1].tree && fed.has(i + 1)
      ? chainEnd[i + 1]
      : i;
  }

  return columns.map((col, i) => {
    if (!col.tree) return { kind: 'raw', text: col.section ?? '' };
    let start = i;
    while (start > 0 && columns[start - 1].tree && fed.has(start)) start--;
    return treeColumnLabel(chainEnd[i] - i, i - start, col.doubleElim);
  });
}
