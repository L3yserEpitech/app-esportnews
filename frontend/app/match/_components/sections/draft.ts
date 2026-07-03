import type { PandaGame } from '../../../types';

export interface TeamDraft { bans: string[]; picks: string[]; }
export interface Draft { team1: TeamDraft; team2: TeamDraft; }

const splitList = (v: unknown): string[] =>
  typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : Array.isArray(v) ? v.map(String) : [];

// Deux formats selon les wikis : liste agrégée (team1bans) ou clés numérotées
// (team1ban1..team1ban5 — LoL, Dota2).
function numbered(ed: Record<string, unknown>, prefix: string): string[] {
  const out: string[] = [];
  for (let i = 1; ed[`${prefix}${i}`] != null && i <= 10; i++) out.push(String(ed[`${prefix}${i}`]));
  return out;
}

function bansFor(ed: Record<string, unknown> | undefined, keys: string[], prefix: string): string[] {
  if (!ed) return [];
  for (const k of keys) if (ed[k] != null) return splitList(ed[k]);
  return numbered(ed, prefix);
}

export function parseDraft(game: PandaGame): Draft | null {
  const ed = game?.extradata;
  const parts = game?.participants ?? [];
  const t1bans = bansFor(ed, ['team1bans', 't1bans'], 'team1ban');
  const t2bans = bansFor(ed, ['team2bans', 't2bans'], 'team2ban');
  let t1picks = parts.filter(p => p.team === 1 && p.character).map(p => p.character as string);
  let t2picks = parts.filter(p => p.team === 2 && p.character).map(p => p.character as string);
  if (!t1picks.length && ed) t1picks = numbered(ed, 'team1champion');
  if (!t2picks.length && ed) t2picks = numbered(ed, 'team2champion');
  // Dota2 numérote les picks en teamNheroK.
  if (!t1picks.length && ed) t1picks = numbered(ed, 'team1hero');
  if (!t2picks.length && ed) t2picks = numbered(ed, 'team2hero');
  if (!t1bans.length && !t2bans.length && !t1picks.length && !t2picks.length) return null;
  return { team1: { bans: t1bans, picks: t1picks }, team2: { bans: t2bans, picks: t2picks } };
}
