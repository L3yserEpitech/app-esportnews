'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '../../contexts/ToastContext';
import {
  Shield, Users, Trophy, Calendar, MapPin, ExternalLink,
  Loader2, Gamepad2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { teamService, EnrichedTeamDetail, Team, Player, TeamMatchesResponse, TeamPlacement } from '../../services/teamService';
import { proxyImageUrl } from '../../lib/imageProxy';
import TournamentMatchCard from '../../components/tournaments/TournamentMatchCard';
import AdColumn from '../../components/ads/AdColumn';
import { PandaMatch, Advertisement } from '../../types';
import { advertisementService } from '../../services/advertisementService';
import { useIsDarkTheme, pickThemeLogo } from '../../hooks/useIsDarkTheme';

interface TeamDetailPageClientProps {
  teamId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Role color system
// ─────────────────────────────────────────────────────────────────────────────
interface RoleConfig { label: string; color: string }

function getRoleConfig(role?: string | null): RoleConfig | null {
  if (!role) return null;
  const lower = role.toLowerCase();
  if (lower.includes('captain') || lower.includes('igl'))  return { label: role, color: '#22d3ee' };
  if (lower.includes('coach'))                             return { label: role, color: '#fbbf24' };
  if (lower.includes('mid'))                               return { label: role, color: '#60a5fa' };
  if (lower.includes('adc') || lower.includes('bot'))      return { label: role, color: '#4ade80' };
  if (lower.includes('support') || lower.includes('sup'))  return { label: role, color: '#facc15' };
  if (lower.includes('top'))                               return { label: role, color: '#f87171' };
  if (lower.includes('jungl') || lower.includes('jgl'))    return { label: role, color: '#c084fc' };
  if (lower.includes('awp') || lower.includes('sniper'))   return { label: role, color: '#fb923c' };
  return { label: role, color: 'var(--color-text-secondary)' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Player row — editorial roster table
// ─────────────────────────────────────────────────────────────────────────────
function PlayerRow({ player, index, isFormer = false }: { player: Player; index: number; isFormer?: boolean }) {
  const rc = getRoleConfig(player.role);
  const initials = player.name.slice(0, 2).toUpperCase();
  const num = String(index + 1).padStart(2, '0');

  return (
    <div
      className="group relative flex items-center gap-3 sm:gap-4 px-4 py-3 transition-colors duration-100 cursor-default border-b border-[var(--color-border-primary)]/20"
      style={{
        opacity: isFormer ? 0.42 : 1,
        animation: 'fadeSlideIn 0.3s ease both',
        animationDelay: `${index * 35}ms`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)';
        if (isFormer) (e.currentTarget as HTMLElement).style.opacity = '0.7';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        if (isFormer) (e.currentTarget as HTMLElement).style.opacity = '0.42';
      }}
    >
      {/* Hover left accent */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-full"
        style={{ background: rc?.color ?? '#F22E62' }}
      />

      {/* Row number */}
      <span
        className="flex-shrink-0 font-mono text-[11px] font-bold select-none w-7 text-right"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}
      >
        {isFormer ? '—' : num}
      </span>

      {/* Avatar */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs border border-[var(--color-border-primary)]/60"
        style={{
          background: 'var(--color-bg-tertiary)',
          color: rc?.color ?? 'var(--color-text-muted)',
          letterSpacing: '-0.03em',
        }}
      >
        {player.image_url
          ? <img src={proxyImageUrl(player.image_url)} alt="" className="w-full h-full object-cover" loading="lazy" />
          : initials
        }
      </div>

      {/* Name block */}
      <div className="flex-1 min-w-0">
        <span
          className="block font-bold truncate leading-tight transition-colors duration-100 group-hover:text-[var(--color-text-primary)]"
          style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', letterSpacing: '-0.01em' }}
        >
          {player.name}
          {isFormer && (
            <span className="ml-2 text-[9px] font-black uppercase tracking-widest align-middle text-[var(--color-text-muted)]">
              ex
            </span>
          )}
        </span>
        {(player.first_name || player.last_name) && (
          <span className="block text-[11px] truncate mt-0.5 text-[var(--color-text-muted)]">
            {[player.first_name, player.last_name].filter(Boolean).join(' ')}
          </span>
        )}
      </div>

      {/* Role — plain colored text */}
      <div className="flex-shrink-0 w-20 sm:w-24 text-right hidden sm:block">
        {rc ? (
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isFormer ? 'var(--color-text-muted)' : rc.color }}>
            {rc.label}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--color-text-muted)]">—</span>
        )}
      </div>

      {/* Nationality */}
      <div className="flex-shrink-0 w-20 sm:w-24 text-right hidden md:block">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
          {player.nationality || '—'}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section title
// ─────────────────────────────────────────────────────────────────────────────
function SectionTitle({ label, count, accentColor = '#F22E62' }: { label: string; count?: number; accentColor?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: accentColor }} />
      <h2 className="font-black text-[var(--color-text-primary)]" style={{ fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
        {label}
        {count !== undefined && (
          <span className="ml-2 text-sm font-semibold text-[var(--color-text-muted)]">({count})</span>
        )}
      </h2>
    </div>
  );
}

const SOCIAL_KEYS: (keyof import('../../services/teamService').TeamLinks)[] = [
  'twitter', 'youtube', 'twitch', 'discord', 'instagram', 'facebook', 'website',
];
const SOCIAL_ICONS: Record<string, string> = {
  twitter: '𝕏', youtube: '▶', twitch: '📺', discord: '💬',
  instagram: '📷', facebook: 'f', website: '🌐',
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function TeamDetailPageClient({ teamId }: TeamDetailPageClientProps) {
  const t = useTranslations('pages_detail.team_detail');
  const tToast = useTranslations('toast');
  const isDark = useIsDarkTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const hasRedirected = useRef(false);
  const searchParams = useSearchParams();
  const wiki = searchParams.get('wiki') || '';
  const urlName = searchParams.get('name') || '';
  const urlAcronym = searchParams.get('acronym') || '';
  const urlLogo = searchParams.get('logo') || '';

  const [team, setTeam] = useState<EnrichedTeamDetail | Team | null>(null);
  const [matches, setMatches] = useState<TeamMatchesResponse | null>(null);
  const [placements, setPlacements] = useState<TeamPlacement[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFormer, setShowFormer] = useState(false);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);

  // ── Load ads ───────────────────────────────────────────────────────────
  useEffect(() => {
    advertisementService.getActiveAdvertisements()
      .then(setAds)
      .catch(() => {})
      .finally(() => setIsLoadingAds(false));
  }, []);

  // ── Load team ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadTeam = async () => {
      setLoading(true);
      setError(null);

      const decodedId = decodeURIComponent(teamId);
      const baseTemplate = decodedId
        .replace(/\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}$/i, '')
        .replace(/\s+\d{4}$/i, '')
        .trim();

      try {
        let data: EnrichedTeamDetail | Team;

        if (wiki && isNaN(Number(decodedId))) {
          const fetchByTemplate = async (template: string): Promise<EnrichedTeamDetail | Team> => {
            const basicTeam = await teamService.getTeamByTemplate(template, wiki);
            try { return await teamService.getTeamDetail(basicTeam.id); } catch { return basicTeam; }
          };
          try {
            data = await fetchByTemplate(decodedId);
          } catch {
            if (baseTemplate !== decodedId) {
              data = await fetchByTemplate(baseTemplate);
            } else {
              throw new Error('Team not found');
            }
          }
        } else if (!isNaN(Number(decodedId))) {
          data = await teamService.getTeamDetail(decodedId);
        } else {
          throw new Error('Invalid team identifier');
        }

        setTeam(data);
      } catch (err) {
        console.error('Error loading team:', err);
        if (urlName && wiki) {
          const base = decodeURIComponent(teamId).replace(/\s+\d{4}$/i, '').trim();
          setTeam({
            id: 0, name: urlName,
            acronym: urlAcronym || base.toUpperCase().slice(0, 4),
            image_url: urlLogo || '', dark_mode_image_url: null,
            location: '', slug: base, players: [], modified_at: '',
            current_videogame: { id: 0, name: wiki, slug: wiki },
          });
        } else {
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            const liquipediaWiki = wiki || 'commons';
            showToast({
              message: tToast('team_not_available'),
              linkUrl: `https://liquipedia.net/${liquipediaWiki}/Main_Page`,
              linkLabel: tToast('view_on_liquipedia'),
              duration: 10000,
            });
            router.back();
          }
        }
      } finally {
        setLoading(false);
      }
    };
    loadTeam();
  }, [teamId, wiki, urlName, urlAcronym, urlLogo, t]);

  // ── Load matches ─────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[TeamMatches] team state changed:', { team, teamId, wiki });
    if (!team) { console.log('[TeamMatches] No team yet, skipping.'); return; }
    const enriched = team as EnrichedTeamDetail;
    const resolvedWiki = enriched.wiki || wiki;
    const decodedIdForMatches = decodeURIComponent(teamId)
      .replace(/\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}$/i, '')
      .replace(/\s+\d{4}$/i, '').trim();
    const resolvedTemplate = enriched.template || decodedIdForMatches;
    console.log('[TeamMatches] Resolved:', { teamId: team.id, resolvedWiki, resolvedTemplate, enrichedWiki: enriched.wiki, enrichedTemplate: (enriched as EnrichedTeamDetail).template });
    if (!resolvedWiki || !resolvedTemplate) {
      console.warn('[TeamMatches] Missing wiki or template — aborting match fetch.');
      return;
    }

    const loadMatches = async () => {
      setMatchesLoading(true);
      try {
        console.log('[TeamMatches] Fetching:', team.id, resolvedWiki, resolvedTemplate, team.name);
        const data = await teamService.getTeamMatches(team.id, resolvedWiki, resolvedTemplate, team.name);
        console.log('[TeamMatches] Result:', { recent: data.recent?.length, upcoming: data.upcoming?.length, data });
        setMatches(data);
      } catch (err) {
        console.error('[TeamMatches] Error loading team matches:', err);
      } finally {
        setMatchesLoading(false);
      }
    };
    loadMatches();
  }, [team, wiki, teamId]);

  // ── Load placements ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!team) return;
    const enriched = team as EnrichedTeamDetail;
    const resolvedWiki = enriched.wiki || wiki;
    if (!resolvedWiki || !team.name) return;

    const loadPlacements = async () => {
      setPlacementsLoading(true);
      try {
        const data = await teamService.getTeamPlacements(team.id, resolvedWiki, team.name, 50);
        setPlacements(data.placements || []);
      } catch (err) {
        console.error('[TeamPlacements] Error:', err);
      } finally {
        setPlacementsLoading(false);
      }
    };
    loadPlacements();
  }, [team, wiki]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-body)] pt-20">
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
          <div className="animate-pulse h-52 rounded-2xl bg-[var(--color-bg-secondary)]" />
          <div className="grid grid-cols-1 gap-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse h-14 rounded-lg bg-[var(--color-bg-secondary)]"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error / No data (redirect already triggered, show loading while navigating) ──
  if (error || !team) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-body)] pt-20">
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
          <div className="animate-pulse h-52 rounded-2xl bg-[var(--color-bg-secondary)]" />
          <div className="grid grid-cols-1 gap-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse h-14 rounded-lg bg-[var(--color-bg-secondary)]"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const enrichedTeam = team as EnrichedTeamDetail;
  const allPlayers: Player[] = team.players || [];
  const activePlayers = allPlayers.filter(p => p.active && !p.role?.toLowerCase().includes('coach'));
  const coaches = allPlayers.filter(p => p.role?.toLowerCase().includes('coach'));
  const formerPlayers = allPlayers.filter(p => !p.active && !p.role?.toLowerCase().includes('coach'));

  const socialLinks = enrichedTeam.links
    ? SOCIAL_KEYS
        .map(key => ({ key, url: enrichedTeam.links![key] }))
        .filter(({ url }) => !!url) as { key: string; url: string }[]
    : [];

  const podiums = placements.filter(p => { const n = parseInt(p.placement); return !isNaN(n) && n <= 3; }).slice(0, 5);

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.6; }
        }
      `}</style>

      <div className="min-h-screen bg-[var(--color-bg-body)] pt-20">

        {/* ════════════════════════════════ HERO ════════════════════════════════ */}
        <div className="relative overflow-hidden border-b border-[var(--color-border-primary)]/40 bg-[var(--color-bg-primary)]">

          {/* Ambient glows — hidden on mobile */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
            <div
              className="absolute -top-28 -left-28 w-96 h-96 rounded-full blur-[100px]"
              style={{ background: 'var(--color-bg-tertiary)', animation: 'ambientPulse 6s ease-in-out infinite' }}
            />
            <div
              className="absolute -bottom-12 right-0 w-72 h-72 rounded-full blur-[90px]"
              style={{ background: '#F22E62', opacity: 0.1, animation: 'ambientPulse 7s ease-in-out infinite 1.5s' }}
            />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 py-8 md:py-12">

            {/* Breadcrumb */}
            <nav className="hidden sm:flex items-center gap-1.5 text-xs mb-8 text-[var(--color-text-muted)]">
              <Link href="/" className="hover:text-[var(--color-text-primary)] transition-colors">Accueil</Link>
              <span>/</span>
              <Link href="/match" className="hover:text-[var(--color-text-primary)] transition-colors">Matchs</Link>
              <span>/</span>
              <span className="text-[var(--color-text-secondary)] truncate max-w-48">{team.name}</span>
            </nav>

            <div className="flex flex-col items-center text-center sm:text-left sm:flex-row sm:items-center gap-5 md:gap-10">

              {/* Logo */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/50"
                >
                  {pickThemeLogo(isDark, enrichedTeam.textless_logo_url || team.image_url || urlLogo, enrichedTeam.textless_logo_dark_url || team.dark_mode_image_url) ? (
                    <img src={proxyImageUrl(pickThemeLogo(isDark, enrichedTeam.textless_logo_url || team.image_url || urlLogo, enrichedTeam.textless_logo_dark_url || team.dark_mode_image_url)!)} alt={team.name} className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain" />
                  ) : (
                    <Shield className="w-10 h-10 text-[var(--color-text-muted)]" />
                  )}
                </div>
                {enrichedTeam.status === 'active' && (
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[var(--color-bg-body)]"
                    style={{ background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }}
                  />
                )}
              </div>

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-3">
                  <h1
                    className="font-black text-[var(--color-text-primary)] leading-none"
                    style={{ fontSize: 'clamp(1.5rem, 4.5vw, 2.75rem)', letterSpacing: '-0.035em' }}
                  >
                    {team.name}
                  </h1>
                  {team.acronym && team.acronym !== team.name && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg tracking-wider bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border border-[var(--color-border-primary)]/60">
                      {team.acronym}
                    </span>
                  )}
                  {enrichedTeam.status === 'active' && (
                    <span
                      className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.28)' }}
                    >
                      ACTIF
                    </span>
                  )}
                </div>

                {/* Meta pills */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-3 md:gap-5 text-sm">
                  {(enrichedTeam.region || team.location) && (
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F22E62' }} />
                      <span className="font-medium">{enrichedTeam.region || team.location}</span>
                    </div>
                  )}
                  {team.current_videogame?.name && (
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <Gamepad2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F22E62' }} />
                      <span className="font-medium">{team.current_videogame.name}</span>
                    </div>
                  )}
                  {enrichedTeam.create_date && (
                    <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F22E62' }} />
                      <span className="font-medium">Fondée en {new Date(enrichedTeam.create_date).getFullYear()}</span>
                    </div>
                  )}
                  {enrichedTeam.earnings && (
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#fbbf24' }} />
                      <span
                        className="font-black text-sm"
                        style={{
                          background: 'linear-gradient(90deg, #fbbf24, #f97316)',
                          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}
                      >
                        {enrichedTeam.earnings}
                      </span>
                    </div>
                  )}
                </div>

                {/* Social links */}
                {socialLinks.length > 0 && (
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                    {socialLinks.map(({ key, url }) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-primary)]/50 hover:border-[#F22E62]/30 hover:text-[var(--color-text-primary)]"
                      >
                        <span>{SOCIAL_ICONS[key] ?? '🔗'}</span>
                        <span className="hidden sm:inline capitalize">{key}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════ CONTENT ════════════════════════════ */}
        <div className="container mx-auto px-4 py-10">
          <div className="flex gap-8">
          <div className="flex-1 min-w-0 space-y-12">

          {/* ── ROSTER ── */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <SectionTitle
                label={t('roster')}
                count={activePlayers.length > 0 ? activePlayers.length : undefined}
                accentColor="#F22E62"
              />
              {formerPlayers.length > 0 && (
                <button
                  onClick={() => setShowFormer(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  {showFormer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {formerPlayers.length} anciens
                </button>
              )}
            </div>

            {allPlayers.length === 0 ? (
              <div className="text-center py-14 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/30">
                <Users className="w-7 h-7 mx-auto mb-2 text-[var(--color-text-muted)]" />
                <p className="text-sm text-[var(--color-text-muted)]">Aucun joueur disponible</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]">

                {/* Column headers */}
                <div className="flex items-center gap-3 sm:gap-4 px-4 py-2 border-b border-[var(--color-border-primary)]/30 bg-[var(--color-bg-primary)]/50">
                  <span className="w-7" />
                  <span className="w-8" />
                  <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Joueur</span>
                  <span className="w-20 sm:w-24 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] hidden sm:block">Rôle</span>
                  <span className="w-20 sm:w-24 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] hidden md:block">Nationalité</span>
                </div>

                {/* Active players */}
                {activePlayers.map((player, i) => (
                  <PlayerRow key={player.id} player={player} index={i} />
                ))}

                {/* Coaches */}
                {coaches.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 border-t border-[var(--color-border-primary)]/20" style={{ background: 'rgba(251,191,36,0.05)' }}>
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(251,191,36,0.5)' }}>Staff</span>
                    </div>
                    {coaches.map((player, i) => (
                      <PlayerRow key={player.id} player={player} index={activePlayers.length + i} />
                    ))}
                  </>
                )}

                {/* Former players */}
                {formerPlayers.length > 0 && showFormer && (
                  <>
                    <div className="px-4 py-1.5 border-t border-[var(--color-border-primary)]/30 bg-[var(--color-bg-primary)]/30">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Anciens joueurs</span>
                    </div>
                    {formerPlayers.map((player, i) => (
                      <PlayerRow key={player.id} player={player} index={i} isFormer />
                    ))}
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── PLACEMENTS (top 3 only) ── */}
          {(placementsLoading || podiums.length > 0) && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <SectionTitle
                  label={t('placements')}
                  count={podiums.length || undefined}
                  accentColor="#fbbf24"
                />
                <Link
                  href={`/equipe/${encodeURIComponent(teamId)}/resultats?${new URLSearchParams({ wiki: wiki || (team as EnrichedTeamDetail)?.wiki || '', name: team?.name || '', ...(team && 'acronym' in team && (team as any).acronym ? { acronym: (team as any).acronym } : {}), ...(team && 'image_url' in team && (team as any).image_url ? { logo: (team as any).image_url } : {}) }).toString()}`}
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
                  <span className="hidden sm:inline">{t('see_all_results_short')}</span>
                  <span className="sm:hidden">{t('see_all_short')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
              {placementsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#fbbf24' }} />
                </div>
              ) : (
                <>
                <div className="rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]">
                  {/* Header */}
                  <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-2 border-b border-[var(--color-border-primary)]/30 bg-[var(--color-bg-primary)]/50">
                    <span className="w-16 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Place</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Tournoi</span>
                    <span className="w-16 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Tier</span>
                    <span className="w-24 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Gains</span>
                    <span className="w-20 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Date</span>
                  </div>
                  {/* Rows */}
                  {podiums.map((p, i) => {
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
                        className="group relative grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_auto_auto] gap-2 sm:gap-3 items-center px-4 py-2.5 border-b border-[var(--color-border-primary)]/20 transition-colors hover:bg-[var(--color-bg-primary)]/40"
                        style={{ animation: 'fadeSlideIn 0.3s ease both', animationDelay: `${i * 25}ms` }}
                      >
                        {/* Placement */}
                        <div className="w-16 flex items-center gap-2">
                          <span
                            className="font-black text-sm tabular-nums"
                            style={{ color: placementColor }}
                          >
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
                        <div className="hidden sm:flex w-16 justify-center">
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
                        <div className="hidden sm:block w-24 text-right">
                          <span className="text-xs font-bold tabular-nums text-[var(--color-text-secondary)]">
                            {prizeFormatted || '—'}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="hidden sm:block w-20 text-right">
                          <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                            {dateFormatted}
                          </span>
                        </div>

                        {/* Mobile: tier + prize + date on second line */}
                        <div className="sm:hidden col-span-2 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                          <span
                            className="font-black uppercase px-1.5 py-0.5 rounded"
                            style={{
                              background: p.tier === '1' ? 'rgba(251,191,36,0.15)' : 'var(--color-bg-primary)',
                              color: p.tier === '1' ? '#fbbf24' : 'var(--color-text-muted)',
                            }}
                          >
                            T{p.tier}
                          </span>
                          {prizeFormatted && <span className="font-bold">{prizeFormatted}</span>}
                          <span className="tabular-nums">{dateFormatted}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                </>
              )}
            </section>
          )}

          {/* ── MATCHES ── */}
          <div className="space-y-10">

            {/* Upcoming */}
            <section>
              <div className="mb-5">
                <SectionTitle
                  label={t('upcoming_matches')}
                  count={matches?.upcoming?.length || undefined}
                  accentColor="#22d3ee"
                />
              </div>
              {matchesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#22d3ee' }} />
                </div>
              ) : matches?.upcoming && matches.upcoming.length > 0 ? (
                <div className="space-y-1.5">
                  {(matches.upcoming as PandaMatch[]).map(match => (
                    <TournamentMatchCard key={match.id || match.match2id} match={match} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/25">
                  <Calendar className="w-7 h-7 mx-auto mb-2 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-muted)]">{t('no_upcoming_matches')}</p>
                </div>
              )}
            </section>

            {/* Recent */}
            <section>
              <div className="mb-5">
                <SectionTitle
                  label={t('recent_matches')}
                  count={matches?.recent?.length || undefined}
                  accentColor="#F22E62"
                />
              </div>
              {matchesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#F22E62' }} />
                </div>
              ) : matches?.recent && matches.recent.length > 0 ? (
                <div className="space-y-1.5">
                  {(matches.recent as PandaMatch[]).map(match => (
                    <TournamentMatchCard key={match.id || match.match2id} match={match} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/25">
                  <Trophy className="w-7 h-7 mx-auto mb-2 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-muted)]">{t('no_matches')}</p>
                </div>
              )}
            </section>
          </div>

          </div>{/* end flex-1 */}

          <AdColumn ads={ads} isLoading={isLoadingAds} />
          </div>{/* end flex */}
        </div>
      </div>
    </>
  );
}
