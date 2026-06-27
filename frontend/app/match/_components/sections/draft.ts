import type { PandaGame } from '../../../types';

export interface TeamDraft { bans: string[]; picks: string[]; }
export interface Draft { team1: TeamDraft; team2: TeamDraft; }

const splitList = (v: unknown): string[] =>
  typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : Array.isArray(v) ? v.map(String) : [];

function bansFor(ed: Record<string, unknown> | undefined, keys: string[]): string[] {
  if (!ed) return [];
  for (const k of keys) if (ed[k] != null) return splitList(ed[k]);
  return [];
}

export function parseDraft(game: PandaGame): Draft | null {
  const ed = game?.extradata;
  const parts = game?.participants ?? [];
  const t1bans = bansFor(ed, ['team1bans', 't1bans']);
  const t2bans = bansFor(ed, ['team2bans', 't2bans']);
  const t1picks = parts.filter(p => p.team === 1 && p.character).map(p => p.character as string);
  const t2picks = parts.filter(p => p.team === 2 && p.character).map(p => p.character as string);
  if (!t1bans.length && !t2bans.length && !t1picks.length && !t2picks.length) return null;
  return { team1: { bans: t1bans, picks: t1picks }, team2: { bans: t2bans, picks: t2picks } };
}
