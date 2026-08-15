// Shared helpers + props contract for modular match-detail sections.
// Extracted from MatchDetailPageClient so each section can be a focused unit.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import type { GameEntry } from '../../../lib/gameRegistry';
import type { PandaMatch } from '../../../types';

export interface MatchSectionProps {
  match: PandaMatch;
  game?: GameEntry;
  isLive: boolean;
  isDark: boolean;
}

export const parseGameWinner = (winner: unknown): { id: number | null; type: string } | null => {
  if (!winner) return null;
  if (typeof winner === 'object' && winner !== null && 'id' in winner) {
    return winner as { id: number | null; type: string };
  }
  if (typeof winner === 'string') {
    try { return JSON.parse(winner); } catch { return null; }
  }
  return null;
};

export const getRoleBadgeStyle = (role?: string | null): string => {
  if (!role) return '';
  const r = role.toLowerCase();
  if (r.includes('captain') || r.includes('igl')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25';
  if (r.includes('coach')) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
  if (r.includes('mid')) return 'text-blue-400 bg-blue-500/10 border-blue-500/25';
  if (r.includes('adc') || r.includes('bot')) return 'text-green-400 bg-green-500/10 border-green-500/25';
  if (r.includes('support') || r.includes('sup')) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25';
  if (r.includes('top')) return 'text-red-400 bg-red-500/10 border-red-500/25';
  if (r.includes('jungl') || r.includes('jgl')) return 'text-purple-400 bg-purple-500/10 border-purple-500/25';
  if (r.includes('awp') || r.includes('sniper')) return 'text-orange-400 bg-orange-500/10 border-orange-500/25';
  return 'text-text-secondary bg-[var(--color-bg-tertiary)]/30 border-[var(--color-border-primary)]/40';
};

export const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export const formatTime = (dateString: string): string =>
  new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h${remaining > 0 ? `${remaining}m` : ''}`;
  }
  return `${minutes}m`;
};

type LogoTeam = { image_url?: string | null; dark_image_url?: string | null; name?: string | null } | null | undefined;

export const TeamLogo = ({ team, isDark, size = 'lg', highlight = false }: {
  team: LogoTeam;
  isDark: boolean;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-12 h-12',
    lg: 'w-14 h-14 sm:w-18 sm:h-18 md:w-24 md:h-24',
  };
  const logo = pickThemeLogo(isDark, team?.image_url, team?.dark_image_url);
  return (
    <div className={`relative ${sizeClasses[size]} flex-shrink-0 group/logo`}>
      {highlight && <div className="absolute -inset-2 bg-[var(--color-accent)]/10 rounded-2xl blur-xl hidden sm:block" />}
      <div className={`relative ${sizeClasses[size]} rounded-xl bg-[var(--color-bg-primary)]/80 border ${
        highlight ? 'border-[var(--color-accent)]/30' : 'border-[var(--color-border-primary)]/40'
      } flex items-center justify-center overflow-hidden transition-all duration-300 group-hover/logo:border-[var(--color-accent)]/20`}>
        {logo ? (
          <img src={proxyImageUrl(logo)} alt={team?.name || ''} className="w-3/4 h-3/4 object-contain" loading="lazy" />
        ) : (
          <Shield className="w-1/3 h-1/3 text-text-muted/60" />
        )}
      </div>
    </div>
  );
};

export const SectionHeader = ({ icon: Icon, title, extra }: { icon: LucideIcon; title: string; extra?: ReactNode }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-1 h-5 rounded-full bg-accent" />
    <Icon className="w-[18px] h-[18px] text-accent" />
    <h2 className="text-xs font-bold text-text-primary uppercase tracking-[0.15em]">{title}</h2>
    {extra && <div className="ml-auto">{extra}</div>}
  </div>
);
