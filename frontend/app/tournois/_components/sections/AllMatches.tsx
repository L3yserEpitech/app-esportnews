'use client';

import { useTranslations } from 'next-intl';
import { Gamepad2, Calendar } from 'lucide-react';
import TournamentMatchCard from '../../../components/tournaments/TournamentMatchCard';
import type { TournamentSectionProps } from './shared';

export default function AllMatches({ matchesByDate, totalMatches }: TournamentSectionProps) {
  const t = useTranslations('pages_detail.tournament_detail');

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <Gamepad2 className="w-5 h-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('all_matches')}</h2>
        <span className="text-xs text-[var(--color-text-muted)] font-medium">
          {totalMatches} {totalMatches > 1 ? t('matches_total_plural') : t('matches_total_singular')}
        </span>
      </div>

      {matchesByDate.length > 0 ? (
        <div className="space-y-6">
          {matchesByDate.map(group => (
            <div key={group.dateKey}>
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-[var(--color-border-primary)]/40" />
                <span className="text-xs text-[var(--color-text-muted)]">
                  {group.matches.length} match{group.matches.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.matches.map(match => (
                  <TournamentMatchCard key={match.match2id || match.id} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : totalMatches === 0 ? (
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-10 text-center">
          <Gamepad2 className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)] font-medium">{t('no_matches')}</p>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{t('no_matches_subtitle')}</p>
        </div>
      ) : null}
    </section>
  );
}
