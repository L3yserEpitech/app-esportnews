'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Loader2, Trophy, AlertCircle } from 'lucide-react';
import { teamService, TeamPlacement } from '../../../services/teamService';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { useIsDarkTheme, pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import AdColumn from '../../../components/ads/AdColumn';
import { Advertisement } from '../../../types';
import { advertisementService } from '../../../services/advertisementService';

interface ResultatsPageClientProps {
  teamId: string;
}

export default function ResultatsPageClient({ teamId }: ResultatsPageClientProps) {
  const t = useTranslations('pages_detail.team_detail');
  const searchParams = useSearchParams();
  const isDark = useIsDarkTheme();

  const wiki = searchParams.get('wiki') || '';
  const name = searchParams.get('name') || decodeURIComponent(teamId);
  const acronym = searchParams.get('acronym') || '';
  const logo = searchParams.get('logo') || '';

  const [placements, setPlacements] = useState<TeamPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);

  useEffect(() => {
    advertisementService.getActiveAdvertisements()
      .then(setAds)
      .catch(() => {})
      .finally(() => setIsLoadingAds(false));
  }, []);

  useEffect(() => {
    if (!wiki || !name) {
      setError('Missing wiki or name');
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const data = await teamService.getTeamPlacements(teamId, wiki, name, 200);
        setPlacements(data.placements || []);
      } catch (err) {
        console.error('[ResultatsPage] Error:', err);
        setError('Failed to load placements');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId, wiki, name]);

  const totalEarnings = useMemo(() => {
    return placements.reduce((sum, p) => sum + (p.prize_money || 0), 0);
  }, [placements]);

  const backUrl = `/equipe/${encodeURIComponent(teamId)}?${new URLSearchParams({ wiki, name, ...(acronym ? { acronym } : {}), ...(logo ? { logo } : {}) }).toString()}`;

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-body)] pt-20">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-4" />
          <p className="text-[var(--color-text-muted)]">{error}</p>
          <Link href={backUrl} className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--color-accent)]">
            <ChevronLeft className="w-4 h-4" />
            {t('back_to_matches')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-body)] pt-20">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex gap-8">
        <div className="flex-1 min-w-0">

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href={backUrl}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            {name}
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            {logo && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={proxyImageUrl(logo)} alt={name} className="w-7 h-7 sm:w-8 sm:h-8 object-contain" loading="lazy" />
              </div>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[var(--color-text-primary)]">
                {t('all_results_title')}
              </h1>
              {!loading && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">
                  <span>{t('total_tournaments')}: <strong className="text-[var(--color-text-primary)]">{placements.length}</strong></span>
                  {totalEarnings > 0 && (
                    <span>{t('total_earnings')}: <strong className="text-green-400">${Math.round(totalEarnings).toLocaleString('en-US')}</strong></span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
          </div>
        ) : placements.length === 0 ? (
          <div className="text-center py-20 text-[var(--color-text-muted)]">
            {t('no_matches')}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-[var(--color-border-primary)]/30 bg-[var(--color-bg-primary)]/50">
              <span className="w-16 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{t('col_place')}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{t('col_tournament')}</span>
              <span className="w-16 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{t('col_tier')}</span>
              <span className="w-24 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{t('col_earnings')}</span>
              <span className="w-20 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{t('col_date')}</span>
            </div>

            {/* Rows */}
            {placements.map((p, i) => {
              const isTop3 = p.placement === '1' || p.placement === '2' || p.placement === '3';
              const placementColor = p.placement === '1' ? '#fbbf24' : p.placement === '2' ? '#94a3b8' : p.placement === '3' ? '#cd7f32' : 'var(--color-text-secondary)';
              const dateFormatted = p.date ? (() => {
                const d = new Date(p.date);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = String(d.getFullYear()).slice(-2);
                return `${dd}/${mm}/${yy}`;
              })() : '';
              const prizeFormatted = p.prize_money > 0
                ? `$${Math.round(p.prize_money).toLocaleString('en-US')}`
                : '';

              return (
                <div
                  key={p.tournament_page + '_' + i}
                  className="group relative border-b border-[var(--color-border-primary)]/20 transition-colors hover:bg-[var(--color-bg-primary)]/40"
                  style={{ animation: i < 30 ? 'fadeSlideIn 0.3s ease both' : undefined, animationDelay: i < 30 ? `${i * 20}ms` : undefined }}
                >
                  {/* Desktop row */}
                  <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5">
                    {/* Placement */}
                    <div className="w-16 flex items-center gap-2">
                      <span className="font-black text-sm tabular-nums" style={{ color: placementColor }}>
                        {isTop3 && <Trophy className="inline w-3.5 h-3.5 mr-1" style={{ color: placementColor }} />}
                        {p.placement}
                      </span>
                    </div>

                    {/* Tournament */}
                    <div className="flex items-center gap-2 min-w-0">
                      {pickThemeLogo(isDark, p.icon_url, p.icon_dark_url) && (
                        <div className="w-6 h-6 rounded bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <img src={proxyImageUrl(pickThemeLogo(isDark, p.icon_url, p.icon_dark_url)!)} alt="" className="w-4 h-4 object-contain" loading="lazy" />
                        </div>
                      )}
                      <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {p.tournament}
                      </span>
                      <span className="hidden lg:inline text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-primary)]/60 px-1.5 py-0.5 rounded flex-shrink-0">
                        {p.type}
                      </span>
                    </div>

                    {/* Tier */}
                    <div className="w-16 flex justify-center">
                      <span
                        className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
                        style={{
                          background: p.tier === '1' ? 'rgba(251,191,36,0.15)' : p.tier === '2' ? 'rgba(148,163,184,0.15)' : 'var(--color-bg-primary)',
                          color: p.tier === '1' ? '#fbbf24' : p.tier === '2' ? '#94a3b8' : 'var(--color-text-muted)',
                        }}
                      >
                        T{p.tier}
                      </span>
                    </div>

                    {/* Prize */}
                    <div className="w-24 text-right">
                      <span className="text-xs font-bold tabular-nums text-[var(--color-text-secondary)]">
                        {prizeFormatted || '—'}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="w-20 text-right">
                      <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                        {dateFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Mobile row */}
                  <div className="sm:hidden flex items-start gap-3 px-3 py-2">
                    {/* Placement badge */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                      style={{
                        background: p.placement === '1' ? 'rgba(251,191,36,0.15)' : p.placement === '2' ? 'rgba(148,163,184,0.15)' : p.placement === '3' ? 'rgba(205,127,50,0.15)' : 'var(--color-bg-primary)',
                      }}
                    >
                      <span className="font-black text-xs tabular-nums" style={{ color: placementColor }}>
                        {p.placement}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {pickThemeLogo(isDark, p.icon_url, p.icon_dark_url) && (
                          <div className="w-5 h-5 rounded bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img src={proxyImageUrl(pickThemeLogo(isDark, p.icon_url, p.icon_dark_url)!)} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" />
                          </div>
                        )}
                        <span className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                          {p.tournament}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--color-text-muted)]">
                        <span
                          className="font-black uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: p.tier === '1' ? 'rgba(251,191,36,0.15)' : 'var(--color-bg-primary)',
                            color: p.tier === '1' ? '#fbbf24' : 'var(--color-text-muted)',
                          }}
                        >
                          T{p.tier}
                        </span>
                        {prizeFormatted && <span className="font-bold text-[var(--color-text-secondary)]">{prizeFormatted}</span>}
                        <span className="tabular-nums ml-auto">{dateFormatted}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </div>{/* end flex-1 */}

        <AdColumn ads={ads} isLoading={isLoadingAds} />
        </div>{/* end flex */}
      </div>
    </div>
  );
}
