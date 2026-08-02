'use client';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { SectionHeader, type MatchSectionProps } from './shared';
import { buildExternalLinks } from './externalLinks';

export default function ExternalStatsLinks({ match }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const links = buildExternalLinks(match.links);
  if (links.length === 0) return null;
  return (
    <section>
      <SectionHeader icon={ExternalLink} title={t('section_external_stats')} />
      <div className="flex flex-wrap gap-2">
        {links.map(l => (
          <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border-primary)]/40 bg-[var(--color-bg-secondary)]/60 text-text-secondary hover:text-accent hover:border-accent/40 transition-colors">
            {l.label} <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </section>
  );
}
