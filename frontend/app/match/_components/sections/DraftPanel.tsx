'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Swords } from 'lucide-react';
import { SectionHeader, type MatchSectionProps } from './shared';
import { parseDraft } from './draft';

export default function DraftPanel({ match }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const games = (match.games ?? []).filter(g => parseDraft(g) !== null);
  const [idx, setIdx] = useState(0);
  if (games.length === 0) return null;

  const draft = parseDraft(games[Math.min(idx, games.length - 1)])!;
  const Side = ({ d, align }: { d: typeof draft.team1; align: 'left' | 'right' }) => (
    <div className={align === 'right' ? 'text-right' : ''}>
      {d.picks.length > 0 && <p className="text-xs text-text-secondary mb-1"><span className="text-text-muted">{t('draft_picks')}:</span> {d.picks.join(', ')}</p>}
      {d.bans.length > 0 && <p className="text-xs text-text-muted"><span className="opacity-60">{t('draft_bans')}:</span> <span className="line-through opacity-70">{d.bans.join(', ')}</span></p>}
    </div>
  );

  return (
    <section>
      <SectionHeader icon={Swords} title={t('section_draft')} extra={
        games.length > 1 ? (
          <select value={idx} onChange={e => setIdx(+e.target.value)}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/40 rounded-md text-[11px] px-2 py-1 text-text-secondary">
            {games.map((g, i) => <option key={g.id} value={i}>{t('game_label')} {g.position}</option>)}
          </select>
        ) : undefined
      } />
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-4">
        <Side d={draft.team1} align="left" />
        <Side d={draft.team2} align="right" />
      </div>
    </section>
  );
}
