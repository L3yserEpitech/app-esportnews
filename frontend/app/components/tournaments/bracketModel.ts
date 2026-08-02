import type { PandaMatch } from '../../types';

// ─── Layout constants ────────────────────────────────────────────────
export const CELL_H = 58;         // match cell height (px)
export const GAP = 16;            // min vertical gap between two cells
export const SLOT = CELL_H + GAP; // vertical pitch of an unlinked column
export const CELL_W = 208;        // match cell width
export const CONNECTOR_W = 56;    // width of the gap between two columns

// ─── Public shape ────────────────────────────────────────────────────

/** Translation key for a column header, with the round number when numeric. */
export interface ColumnLabel {
  key: string;
  round?: number;
}

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

/** A round with no tree: one column of matches, never any connector. */
export interface GroupColumn {
  key: string;
  /** Liquipedia's raw section name — the only header these rounds have. */
  label: string;
  matches: PandaMatch[];
}

const EMPTY: BracketLayout = { columns: [], edges: [], width: 0, height: 0 };

/** Left offset of a column on the canvas. */
export function columnX(index: number): number {
  return index * (CELL_W + CONNECTOR_W);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function matchKey(m: PandaMatch): string {
  return m.match2id || String(m.id);
}

/**
 * Liquipedia has exactly two shapes. `bracket` is a declared elimination tree —
 * the only thing that gets connectors. `matchlist` covers Swiss rounds, group
 * stages, tiebreakers and plain day-by-day lists indiscriminately: no field
 * distinguishes them, and no structural signal does either (a DreamLeague
 * "May 13-A" column has teams playing twice, a CCT Swiss round does not). They
 * are laid out as plain columns above the tree, with no linkage invented.
 */
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

/**
 * Round name from the distance to the end of its connected chain. Derived from
 * the chain rather than `coordinates.round_count`, because a bracket authored as
 * one mini-bracket per round reports round_count = 1 on every single match.
 * Double-elimination columns mix upper and lower rounds, so they stay numeric.
 */
function treeColumnLabel(fromEnd: number, indexInChain: number, doubleElim: boolean): ColumnLabel {
  if (doubleElim) return { key: 'bracket_round', round: indexInChain + 1 };
  switch (fromEnd) {
    case 0: return { key: 'bracket_final' };
    case 1: return { key: 'bracket_semifinals' };
    case 2: return { key: 'bracket_quarterfinals' };
    case 3: return { key: 'bracket_round_of_16' };
    case 4: return { key: 'bracket_round_of_32' };
    case 5: return { key: 'bracket_round_of_64' };
    default: return { key: 'bracket_round', round: indexInChain + 1 };
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
  doubleElim: boolean;
  /** First column of a Liquipedia stage, before we know what actually feeds it. */
  stageFirst: boolean;
  cells: PandaMatch[];
}

/**
 * Positions every match from Liquipedia's own bracket topology: columns come
 * from `coordinates.round_index`, vertical order from `match_index_in_round`,
 * and a child sits at the average height of the matches that actually feed it.
 */
export function buildBracketLayout(matches: PandaMatch[]): BracketLayout {
  const columns = buildColumns(matches);
  if (columns.length === 0) return EMPTY;

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

/**
 * The non-tree rounds, one column per Liquipedia section, in the page's own
 * order. No positioning and no edges: nothing advances into a fixed slot here,
 * so anything drawn between these columns would be a lie.
 */
export function buildGroupColumns(matches: PandaMatch[]): GroupColumn[] {
  const seen = new Set<string>();
  const lists = new Map<string, PandaMatch[]>();
  for (const m of matches) {
    const k = matchKey(m);
    if (seen.has(k)) continue;
    seen.add(k);
    if (m.bracket_data?.type === 'matchlist' && m.section) push(lists, m.section, m);
  }

  return [...lists.entries()]
    .map(([section, group]) => ({
      key: `group:${section}`,
      label: section,
      order: Math.min(...group.map(m => m.bracket_data!.bracket_index)),
      matches: [...group].sort(
        (a, b) =>
          a.bracket_data!.bracket_index - b.bracket_data!.bracket_index ||
          (a.bracket_data!.match_index ?? 0) - (b.bracket_data!.match_index ?? 0) ||
          String(a.begin_at ?? '').localeCompare(String(b.begin_at ?? '')),
      ),
    }))
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, matches: cells }) => ({ key, label, matches: cells }));
}

/** One column per round of each declared bracket, left to right. */
function buildColumns(matches: PandaMatch[]): RawColumn[] {
  const seen = new Set<string>();
  const trees = new Map<string, PandaMatch[]>();
  for (const m of matches) {
    const k = matchKey(m);
    if (seen.has(k)) continue;
    seen.add(k);
    if (isTree(m) && m.match2bracketid) push(trees, m.match2bracketid, m);
  }

  return [...trees.values()]
    .map(group => {
      const doubleElim = Math.max(...group.map(m => m.bracket_data!.coordinates!.section_count), 1) > 1;
      const roundIndexes = [...new Set(group.map(m => m.bracket_data!.coordinates!.round_index))].sort(
        (a, b) => a - b,
      );
      return {
        // bracket_index is Liquipedia's own left-to-right order for the page.
        order: Math.min(...group.map(m => m.bracket_data!.bracket_index)),
        columns: roundIndexes.map(roundIndex => ({
          key: `${group[0].match2bracketid}:${roundIndex}`,
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
      };
    })
    .sort((a, b) => a.order - b.order)
    .flatMap(s => s.columns);
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
    if (i === 0) return;

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

    const winnerToMatch = new Map<number, string>();
    for (const m of columns[i - 1].cells) {
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

/** Name each column from its position in the chain of columns that feed each other. */
function columnLabels(columns: RawColumn[], fed: Set<number>): ColumnLabel[] {
  const chainEnd: number[] = [];
  for (let i = columns.length - 1; i >= 0; i--) {
    chainEnd[i] = i + 1 < columns.length && fed.has(i + 1) ? chainEnd[i + 1] : i;
  }

  return columns.map((col, i) => {
    let start = i;
    while (start > 0 && fed.has(start)) start--;
    return treeColumnLabel(chainEnd[i] - i, i - start, col.doubleElim);
  });
}
