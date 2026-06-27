import type { PandaGame, PandaParticipant } from '../../../types';

export interface StatColumn {
  key: string;
  label: string; // i18n key suffix under pages_detail.match_detail.stat_col
  fmt: (p: PandaParticipant) => string;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null;
const kfmt = (v: unknown): string => {
  const n = num(v);
  return n === null ? '-' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
};
const kda = (p: PandaParticipant): string =>
  [p.kills, p.deaths, p.assists].every(x => x == null) ? '-' : `${p.kills ?? 0} / ${p.deaths ?? 0} / ${p.assists ?? 0}`;
const ex = (p: PandaParticipant, key: string): unknown => (p.extra ? p.extra[key] : undefined);
const plain = (v: unknown): string => (v == null || v === '' ? '-' : String(v));

const COLUMNS: Record<string, StatColumn[]> = {
  leagueoflegends: [
    { key: 'character', label: 'champion', fmt: p => plain(p.character) },
    { key: 'kda', label: 'kda', fmt: kda },
    { key: 'cs', label: 'cs', fmt: p => plain(ex(p, 'cs')) },
    { key: 'gold', label: 'gold', fmt: p => kfmt(ex(p, 'gold')) },
    { key: 'damage', label: 'damage', fmt: p => kfmt(ex(p, 'damage')) },
  ],
  valorant: [
    { key: 'character', label: 'agent', fmt: p => plain(p.character) },
    { key: 'acs', label: 'acs', fmt: p => plain(ex(p, 'acs')) },
    { key: 'kda', label: 'kda', fmt: kda },
    { key: 'adr', label: 'adr', fmt: p => plain(ex(p, 'adr')) },
    { key: 'kast', label: 'kast', fmt: p => plain(ex(p, 'kast')) },
  ],
  dota2: [
    { key: 'character', label: 'hero', fmt: p => plain(p.character) },
    { key: 'kda', label: 'kda', fmt: kda },
    { key: 'netWorth', label: 'net_worth', fmt: p => kfmt(ex(p, 'netWorth')) },
    { key: 'gpm', label: 'gpm', fmt: p => plain(ex(p, 'gpm')) },
    { key: 'xpm', label: 'xpm', fmt: p => plain(ex(p, 'xpm')) },
  ],
};

export function getStatColumns(wiki: string): StatColumn[] {
  return COLUMNS[wiki] ?? [];
}

export interface PlayerRow {
  player: string;
  cells: Record<string, string>;
}

function rowsFor(parts: PandaParticipant[], cols: StatColumn[]): PlayerRow[] {
  return parts.map(p => ({
    player: p.player || '-',
    cells: Object.fromEntries(cols.map(c => [c.key, c.fmt(p)])),
  }));
}

export function buildPlayerRows(
  game: PandaGame,
  wiki: string,
): { team1: PlayerRow[]; team2: PlayerRow[]; columns: StatColumn[] } {
  const cols = getStatColumns(wiki);
  const parts = game?.participants ?? [];
  return {
    team1: rowsFor(parts.filter(p => p.team === 1), cols),
    team2: rowsFor(parts.filter(p => p.team === 2), cols),
    columns: cols,
  };
}
