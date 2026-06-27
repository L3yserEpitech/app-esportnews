'use client';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { SectionHeader, formatDate, formatTime, type MatchSectionProps } from './shared';

export default function MatchInfo({ match }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');

  const rows = [
    { label: t('info_match_id'), value: String(match.id) },
    match.match2id ? { label: t('info_match2id'), value: match.match2id } : null,
    match.slug ? { label: t('info_slug'), value: match.slug } : null,
    match.match_type ? { label: t('info_match_type'), value: match.match_type } : null,
    match.section ? { label: t('info_section'), value: match.section } : null,
    match.tournament?.region ? { label: t('info_region'), value: match.tournament.region } : null,
    match.tournament?.prizepool ? { label: t('info_prizepool'), value: match.tournament.prizepool } : null,
    match.patch ? { label: t('info_patch'), value: match.patch } : null,
    match.mvp ? { label: t('info_mvp'), value: match.mvp } : null,
    match.scheduled_at ? { label: t('info_scheduled_at'), value: `${formatDate(match.scheduled_at)} ${formatTime(match.scheduled_at)}` } : null,
    match.rescheduled && match.original_scheduled_at ? { label: t('info_original_date'), value: `${formatDate(match.original_scheduled_at)} ${formatTime(match.original_scheduled_at)}` } : null,
    match.end_at ? { label: t('info_end_at'), value: `${formatDate(match.end_at)} ${formatTime(match.end_at)}` } : null,
    match.wiki ? { label: t('info_wiki'), value: match.wiki } : null,
    match.live?.supported !== undefined ? { label: t('info_live_supported'), value: match.live.supported ? t('yes') : t('no') } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <section>
      <SectionHeader icon={Info} title={t('section_match_info')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-[var(--color-bg-secondary)]/40 border border-[var(--color-border-primary)]/15 hover:border-[var(--color-border-primary)]/30 transition-colors">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex-shrink-0">{row.label}</span>
            <span className="text-xs text-text-primary font-medium text-right truncate font-mono">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
