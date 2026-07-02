'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Swords, Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { valorantAgentIcon } from '../../../lib/valorantAssets';
import { SectionHeader, type MatchSectionProps } from './shared';
import { parseDraft, type TeamDraft } from './draft';

const AgentTile = ({ name, banned = false }: { name: string; banned?: boolean }) => {
  const icon = valorantAgentIcon(name);
  return (
    <div className={`group/agent flex flex-col items-center gap-1 ${banned ? 'opacity-50' : ''}`} title={name}>
      <div className={`w-11 h-11 md:w-14 md:h-14 rounded-xl overflow-hidden border bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 flex items-center justify-center transition-all duration-300 ${
        banned
          ? 'border-[var(--color-border-primary)]/30 grayscale'
          : 'border-[var(--color-border-primary)]/40 group-hover/agent:border-accent/50 group-hover/agent:scale-105'
      }`}>
        {icon ? (
          <img src={icon} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-[10px] font-bold text-text-secondary px-1 text-center leading-tight">{name}</span>
        )}
      </div>
      <span className={`text-[8px] md:text-[9px] font-semibold uppercase tracking-wide text-text-muted ${banned ? 'line-through' : ''}`}>
        {name}
      </span>
    </div>
  );
};

type Opponent = NonNullable<NonNullable<MatchSectionProps['match']['opponents']>[number]['opponent']>;

const TeamAgentsSide = ({ d, team, isDark, align }: {
  d: TeamDraft;
  team?: Opponent | null;
  isDark: boolean;
  align: 'left' | 'right';
}) => {
  const t = useTranslations('pages_detail.match_detail');
  const logo = pickThemeLogo(isDark, team?.image_url, team?.dark_image_url);
  const right = align === 'right';
  return (
    <div className={`flex flex-col gap-3 min-w-0 ${right ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 min-w-0 ${right ? 'flex-row-reverse' : ''}`}>
        <div className="w-6 h-6 rounded-md bg-[var(--color-bg-primary)]/60 border border-[var(--color-border-primary)]/20 flex items-center justify-center overflow-hidden flex-shrink-0">
          {logo ? (
            <img src={proxyImageUrl(logo)} alt="" className="w-4 h-4 object-contain" loading="lazy" />
          ) : (
            <Shield className="w-3 h-3 text-text-muted/40" />
          )}
        </div>
        <span className="text-xs font-bold text-text-primary truncate">{team?.acronym || team?.name || '-'}</span>
      </div>
      {d.picks.length > 0 && (
        <div className={`flex flex-wrap gap-2 md:gap-2.5 ${right ? 'justify-end' : ''}`}>
          {d.picks.map((p, i) => <AgentTile key={`${p}-${i}`} name={p} />)}
        </div>
      )}
      {d.bans.length > 0 && (
        <div className={`flex items-center flex-wrap gap-2 ${right ? 'flex-row-reverse' : ''}`}>
          <span className="text-[9px] text-text-muted/60 uppercase tracking-wider font-semibold">{t('draft_bans')}</span>
          {d.bans.map((b, i) => <AgentTile key={`${b}-${i}`} name={b} banned />)}
        </div>
      )}
    </div>
  );
};

export default function DraftPanel({ match, isDark, game: gameEntry }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const games = (match.games ?? []).filter(g => parseDraft(g) !== null);
  const [idx, setIdx] = useState(0);
  if (games.length === 0) return null;

  const draft = parseDraft(games[Math.min(idx, games.length - 1)])!;
  const isValorant = (match.wiki || gameEntry?.wiki) === 'valorant';
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;

  const Side = ({ d, align }: { d: TeamDraft; align: 'left' | 'right' }) => (
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
      {isValorant ? (
        <div className="relative rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-4 md:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4">
            <TeamAgentsSide d={draft.team1} team={homeTeam} isDark={isDark} align="left" />
            <TeamAgentsSide d={draft.team2} team={awayTeam} isDark={isDark} align="right" />
          </div>
          <div className="hidden sm:flex absolute inset-y-4 left-1/2 -translate-x-1/2 items-center pointer-events-none">
            <span className="text-[10px] font-black text-text-muted/30 tracking-widest">VS</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-4">
          <Side d={draft.team1} align="left" />
          <Side d={draft.team2} align="right" />
        </div>
      )}
    </section>
  );
}
