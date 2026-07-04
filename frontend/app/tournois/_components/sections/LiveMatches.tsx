'use client';

import { useTranslations } from 'next-intl';
import TournamentMatchCard from '../../../components/tournaments/TournamentMatchCard';
import type { TournamentSectionProps } from './shared';

export default function LiveMatches({ liveMatches }: TournamentSectionProps) {
  const t = useTranslations('pages_detail.tournament_detail');
  if (liveMatches.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-status-live)]" />
        </span>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('live_matches_title')}</h2>
        <span className="text-xs font-semibold text-[var(--color-status-live)] bg-[var(--color-status-live)]/10 px-2 py-0.5 rounded">
          {liveMatches.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {liveMatches.map(match => (
          <TournamentMatchCard key={match.match2id || match.id} match={match} />
        ))}
      </div>
    </section>
  );
}
