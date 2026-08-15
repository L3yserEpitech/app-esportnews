'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';
import { SectionHeader, type MatchSectionProps } from './shared';
import { buildPlayerRows } from './statColumns';

export default function PlayerStatsTable({ match, game }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const wiki = game?.wiki ?? match.wiki ?? '';
  const games = (match.games ?? []).filter(g => (g.participants?.length ?? 0) > 0);
  const [idx, setIdx] = useState(0);
  if (games.length === 0) return null;

  const selected = games[Math.min(idx, games.length - 1)];
  const { team1, team2, columns } = buildPlayerRows(selected, wiki);
  if (columns.length === 0 || (team1.length === 0 && team2.length === 0)) return null;

  const Table = ({ rows }: { rows: typeof team1 }) => (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-text-muted uppercase tracking-wider text-[10px]">
          <th className="text-left py-1.5 px-2">{t('stat_col.player')}</th>
          {columns.map(c => <th key={c.key} className="text-right py-1.5 px-2">{t(`stat_col.${c.label}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-[var(--color-border-primary)]/15">
            <td className="text-left py-1.5 px-2 font-semibold text-text-primary truncate">{r.player}</td>
            {columns.map(c => <td key={c.key} className="text-right py-1.5 px-2 tabular-nums text-text-secondary">{r.cells[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <section>
      <SectionHeader icon={TrendingUp} title={t('section_player_stats')} extra={
        games.length > 1 ? (
          <select value={idx} onChange={e => setIdx(+e.target.value)}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/40 rounded-md text-[11px] px-2 py-1 text-text-secondary">
            {games.map((g, i) => <option key={g.id} value={i}>{t('game_label')} {g.position}{g.map ? ` · ${g.map}` : ''}</option>)}
          </select>
        ) : undefined
      } />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-2 overflow-x-auto"><Table rows={team1} /></div>
        <div className="rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-2 overflow-x-auto"><Table rows={team2} /></div>
      </div>
    </section>
  );
}
