'use client';
import { useTranslations } from 'next-intl';
import { Map as MapIcon, Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../../lib/imageProxy';
import { pickThemeLogo } from '../../../../hooks/useIsDarkTheme';
import { csMapImage, flattenVeto } from './csAssets';
import { SectionHeader, type MatchSectionProps } from '../shared';

export default function MapVetoStrip({ match, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const veto = match.mapveto;
  if (!veto || veto.length === 0) return null;
  const steps = flattenVeto(veto);
  if (steps.length === 0) return null;

  const teams = [match.opponents?.[0]?.opponent, match.opponents?.[1]?.opponent];

  return (
    <section>
      <SectionHeader icon={MapIcon} title={t('map_veto_title')} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 md:gap-3">
        {steps.map((step, i) => {
          const img = csMapImage(step.map);
          const team = step.teamIndex !== null ? teams[step.teamIndex] : null;
          const logo = team ? pickThemeLogo(isDark, team.image_url, team.dark_image_url) : null;
          const isBan = step.type === 'ban';

          return (
            <div
              key={`${step.map}-${i}`}
              className={`group relative aspect-[16/11] rounded-xl overflow-hidden border transition-all duration-300 ${
                isBan
                  ? 'border-[var(--color-border-primary)]/25'
                  : step.type === 'decider'
                    ? 'border-amber-400/35 hover:border-amber-400/60'
                    : 'border-[var(--color-accent)]/35 hover:border-[var(--color-accent)]/60'
              }`}
            >
              {img ? (
                <img
                  src={img}
                  alt={step.map}
                  loading="lazy"
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
                    isBan ? 'grayscale opacity-45' : ''
                  }`}
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br from-[#091626] to-[#182859]/40 ${isBan ? 'opacity-60' : ''}`} />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,19,0.5)_0%,transparent_35%,transparent_50%,rgba(6,11,19,0.92)_100%)]" />

              <span className="absolute top-1.5 left-2 text-[9px] font-bold text-white/40 tabular-nums">{i + 1}</span>

              {isBan && (
                <span className="absolute top-1.5 right-2 text-[9px] font-black text-[var(--color-accent)] uppercase tracking-[0.2em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {t('veto_ban')}
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-3">
                <div className={`text-[11px] md:text-xs font-black uppercase tracking-[0.15em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
                  isBan ? 'text-white/55 line-through decoration-[var(--color-accent)]/70 decoration-2' : 'text-white'
                }`}>
                  {step.map}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {step.type === 'decider' ? (
                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">{t('veto_decider')}</span>
                  ) : (
                    <>
                      <div className="w-4 h-4 rounded-full bg-[#060B13]/80 ring-1 ring-white/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {logo ? (
                          <img src={proxyImageUrl(logo)} alt="" className="w-3 h-3 object-contain" loading="lazy" />
                        ) : (
                          <Shield className="w-2 h-2 text-white/30" />
                        )}
                      </div>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider truncate ${isBan ? 'text-white/45' : 'text-white/80'}`}>
                        {isBan ? '' : `${t('veto_pick')} · `}{team?.acronym || team?.name || '-'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
