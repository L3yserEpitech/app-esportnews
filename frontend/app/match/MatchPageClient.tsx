'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, X, ChevronLeft, ChevronRight, ArrowUpDown, Check, Calendar, Trophy, Star } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import LiquipediaBadge from '../components/common/LiquipediaBadge';
import { LiveMatch, Advertisement } from '../types';
import { matchService } from '../services/matchService';
import { advertisementService } from '../services/advertisementService';
import TournamentMatchCard from '../components/tournaments/TournamentMatchCard';
import FeaturedMatchCard from '../components/matches/FeaturedMatchCard';
import GameSelector from '../components/games/GameSelector';
import AdColumn from '../components/ads/AdColumn';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

// Hook pour détecter le nombre de dates visibles selon la taille d'écran
const useVisibleDatesCount = (): number => {
  const [count, setCount] = useState(11); // Default to desktop

  useEffect(() => {
    const getCount = () => {
      if (typeof window === 'undefined') return 11;
      const width = window.innerWidth;
      // Breakpoints Tailwind: sm=640, md=768, lg=1024
      if (width < 640) return 5;      // Mobile
      if (width < 768) return 7;      // Tablet (sm)
      if (width < 1024) return 9;     // Medium (md)
      return 11;                       // Large (lg+)
    };

    setCount(getCount());

    const handleResize = () => setCount(getCount());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return count;
};

// Utility functions for date manipulation
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDayName = (date: Date, locale: string): string => {
  const dayNames: { [key: string]: string[] } = {
    fr: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    en: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    it: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
  };
  const lang = locale.substring(0, 2);
  return (dayNames[lang] || dayNames['en'])[date.getDay()];
};

const getMonthName = (date: Date, locale: string): string => {
  return date.toLocaleDateString(locale, { month: 'short' });
};

const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Generate array of dates centered on current date
// visibleCount: nombre de dates visibles selon la taille d'écran (5, 7, 9 ou 11)
const generateDateRange = (centerDate: Date, offset: number = 0, visibleCount: number = 11): Date[] => {
  const dates: Date[] = [];
  const adjustedCenter = new Date(centerDate);
  // Décaler du nombre de dates visibles (pas toujours 11)
  adjustedCenter.setDate(adjustedCenter.getDate() + offset * visibleCount);

  // Toujours générer 11 dates pour le rendu, mais le décalage est basé sur visibleCount
  const halfRange = 5;
  for (let i = -halfRange; i <= halfRange; i++) {
    const date = new Date(adjustedCenter);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
};

const MatchPage: React.FC = () => {
  const t = useTranslations();
  const locale = useLocale();
  const { selectedGame, games, isLoadingGames, setSelectedGame, getSelectedGameData } = useGame();
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRangeOffset, setDateRangeOffset] = useState(0);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState<'-begin_at' | 'begin_at'>('-begin_at');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Nombre de dates visibles selon la taille d'écran
  const visibleDatesCount = useVisibleDatesCount();

  const selectedGameData = getSelectedGameData();

  // Compteur pour forcer un rechargement (refresh manuel)
  const [refreshKey, setRefreshKey] = useState(0);

  // Primitives stables pour les deps du useEffect (pas d'objets/fonctions)
  const gameAcronym = selectedGameData?.acronym;
  const selectedDateStr = formatDateToYYYYMMDD(selectedDate);

  // Générer la plage de dates (décalage basé sur le nombre de dates visibles)
  const dateRange = useMemo(
    () => generateDateRange(new Date(), dateRangeOffset, visibleDatesCount),
    [dateRangeOffset, visibleDatesCount]
  );

  // Compteur de version pour garantir que seul le dernier fetch met à jour l'état
  const fetchVersionRef = useRef(0);

  // Unique source de chargement des matchs : réagit à date, jeu, refresh
  useEffect(() => {
    if (isLoadingGames || games.length === 0) return;

    // Incrémenter la version — seule la dernière version pourra écrire dans le state
    const version = ++fetchVersionRef.current;

    setMatches([]);
    setLoading(true);
    setError(null);

    matchService.getMatchesByDate(selectedDateStr, gameAcronym)
      .then(fetchedMatches => {
        if (fetchVersionRef.current !== version) return;

        const validMatches = Array.isArray(fetchedMatches)
          ? fetchedMatches.filter(match => {
              const hasValidTeams = match.opponents &&
                match.opponents.length >= 2 &&
                match.opponents[0]?.opponent?.name &&
                match.opponents[1]?.opponent?.name;

              const gameName = match.videogame?.name?.toLowerCase() || '';
              const isBannedGame = gameName.includes('mobile legends') || gameName.includes('starcraft');

              // Filtrer par date : ne garder que les matchs dont la date locale correspond
              const matchDateRaw = match.begin_at || match.scheduled_at;
              if (matchDateRaw) {
                const matchLocalDate = formatDateToYYYYMMDD(new Date(matchDateRaw));
                if (matchLocalDate !== selectedDateStr) return false;
              }

              return hasValidTeams && !isBannedGame;
            })
          : [];

        setMatches(validMatches);
      })
      .catch(err => {
        if (fetchVersionRef.current !== version) return;
        console.error('Error loading matches:', err);
        setError('Erreur lors du chargement des matchs');
        setMatches([]);
      })
      .finally(() => {
        if (fetchVersionRef.current === version) {
          setLoading(false);
        }
      });
  // Uniquement des primitives dans les deps — pas de t, pas d'objets Date
  }, [selectedDateStr, gameAcronym, isLoadingGames, games.length, refreshKey]);

  // Charger les publicités
  const loadAds = useCallback(async () => {
    try {
      setIsLoadingAds(true);
      const fetchedAds = await advertisementService.getActiveAdvertisements();
      setAds(fetchedAds);
    } catch (error) {
      console.error('Erreur lors du chargement des publicités:', error);
    } finally {
      setIsLoadingAds(false);
    }
  }, []);

  // Charger les publicités au démarrage
  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Raccourci clavier pour ouvrir la modale de recherche (⌘K ou Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      // Fermer avec Escape
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtre strict par date sélectionnée (dernière barrière — exécuté à chaque render)
  const dateFilteredMatches = useMemo(() => {
    return matches.filter(match => {
      const raw = match.begin_at || match.scheduled_at;
      if (!raw) return false;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return false;
      return formatDateToYYYYMMDD(d) === selectedDateStr;
    });
  }, [matches, selectedDateStr]);

  // Sort matches client-side
  const sortedMatches = useMemo(() => {
    const sorted = [...dateFilteredMatches];
    sorted.sort((a, b) => {
      const dateA = a.begin_at || a.scheduled_at || '';
      const dateB = b.begin_at || b.scheduled_at || '';
      if (sortBy === '-begin_at') return dateB.localeCompare(dateA);
      return dateA.localeCompare(dateB);
    });
    return sorted;
  }, [dateFilteredMatches, sortBy]);

  // Filtrer les matchs selon la recherche
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedMatches;
    }

    const query = searchQuery.toLowerCase().trim();
    return sortedMatches.filter((match) => {
      const nameMatch = match.name?.toLowerCase().includes(query);
      const slugMatch = match.slug?.toLowerCase().includes(query);
      const statusMatch = match.status?.toLowerCase().includes(query);
      const tournamentMatch = match.tournament?.name?.toLowerCase().includes(query);
      const leagueMatch = match.league?.name?.toLowerCase().includes(query);
      const gameMatch = match.videogame?.name?.toLowerCase().includes(query);
      const opponentsMatch = match.opponents?.some(
        (opp) => opp.opponent?.name?.toLowerCase().includes(query) ||
          opp.opponent?.acronym?.toLowerCase().includes(query)
      );

      return nameMatch || slugMatch || statusMatch || tournamentMatch || leagueMatch || gameMatch || opponentsMatch;
    });
  }, [sortedMatches, searchQuery]);

  // Mémoriser les handlers
  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setMatches([]);
    setLoading(true);
    setSelectedDate(date);
  }, []);

  const handlePrevRange = useCallback(() => {
    setDateRangeOffset((prev) => prev - 1);
  }, []);

  const handleNextRange = useCallback(() => {
    setDateRangeOffset((prev) => prev + 1);
  }, []);

  // Loading skeletons (horizontal row style matching TournamentMatchCard)
  const loadingSkeletons = useMemo(() =>
    [...Array(8)].map((_, index) => (
      <div key={`skeleton-${index}`} className="flex overflow-hidden rounded-lg border border-border-primary/30 bg-bg-secondary animate-pulse">
        <div className="w-[3px] bg-bg-tertiary flex-shrink-0" />
        <div className="flex-1 flex items-center px-2 sm:px-4 py-3 gap-3">
          <div className="w-10 h-4 rounded bg-bg-tertiary flex-shrink-0" />
          <div className="flex-1 flex items-center justify-end gap-2">
            <div className="h-3.5 bg-bg-tertiary rounded w-20 hidden sm:block" />
            <div className="w-7 h-7 rounded bg-bg-tertiary flex-shrink-0" />
          </div>
          <div className="w-14 h-5 rounded bg-bg-tertiary flex-shrink-0" />
          <div className="flex-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-bg-tertiary flex-shrink-0" />
            <div className="h-3.5 bg-bg-tertiary rounded w-20 hidden sm:block" />
          </div>
          <div className="w-6 h-6 rounded bg-bg-tertiary flex-shrink-0 hidden md:block" />
        </div>
      </div>
    )), []);

  // Grouper les matchs par statut : top tier, live, à venir, terminés
  const matchesByStatus = useMemo(() => {
    const tierOrder = ['s', 'a', 'b', 'c', 'd'];
    const live: LiveMatch[] = [];
    const upcoming: LiveMatch[] = [];
    const finished: LiveMatch[] = [];

    // Trouver le tier le plus haut disponible parmi les matchs du jour
    let bestTier: string | null = null;
    for (const tier of tierOrder) {
      if (sortedMatches.some(m => m.tournament?.tier?.toLowerCase() === tier)) {
        bestTier = tier;
        break;
      }
    }

    // Collecter les matchs du meilleur tier
    const topTier: LiveMatch[] = [];
    const topTierIds = new Set<number>();
    if (bestTier) {
      sortedMatches.forEach((match) => {
        if (match.tournament?.tier?.toLowerCase() === bestTier) {
          topTier.push(match);
          topTierIds.add(match.id);
        }
      });
    }

    sortedMatches.forEach((match) => {
      if (match.status === 'running') live.push(match);
      else if (match.status === 'finished') finished.push(match);
      else upcoming.push(match);
    });

    return { topTier, topTierLabel: bestTier?.toUpperCase() || null, live, upcoming, finished };
  }, [sortedMatches]);

  // Mémoriser la liste des matchs groupée par statut (même style de délimiteur que la page tournoi détaillé)
  const matchesList = useMemo(() => {
    const { topTier, topTierLabel, live, upcoming, finished } = matchesByStatus;
    const sections: React.ReactNode[] = [];

    if (topTier.length > 0 && topTierLabel) {
      sections.push(
        <div key="top-tier">
          <div className="flex items-center gap-3 mb-3">
            <Star className="w-3.5 h-3.5 text-[var(--color-tier-s)]" />
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
              Meilleurs matchs du jour
            </span>
            <div className="flex-1 h-px bg-[var(--color-border-primary)]/40" />
            <span className="text-xs text-[var(--color-text-muted)]">
              {topTier.length} match{topTier.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="relative">
            <Carousel opts={{ align: 'start', loop: false }} className="w-full">
              <CarouselContent className="-ml-3">
                {topTier.map((match) => (
                  <CarouselItem key={match.id} className="pl-3 basis-[300px] sm:basis-[360px] flex-shrink-0">
                    <FeaturedMatchCard match={match} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {topTier.length > 2 && (
                <>
                  <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 !size-10 bg-[var(--color-bg-primary)]/90 backdrop-blur-sm border border-[var(--color-border-primary)]/60 hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]/40 text-[var(--color-text-primary)] shadow-lg shadow-black/30 z-10 [&_svg]:!size-5" />
                  <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 !size-10 bg-[var(--color-bg-primary)]/90 backdrop-blur-sm border border-[var(--color-border-primary)]/60 hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]/40 text-[var(--color-text-primary)] shadow-lg shadow-black/30 z-10 [&_svg]:!size-5" />
                </>
              )}
            </Carousel>
          </div>
        </div>
      );
    }

    if (live.length > 0) {
      sections.push(
        <div key="live">
          <div className="flex items-center gap-3 mb-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-status-live)]" />
            </span>
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
              {t('pages_detail.match.card_status_live')}
            </span>
            <div className="flex-1 h-px bg-[var(--color-border-primary)]/40" />
            <span className="text-xs text-[var(--color-text-muted)]">
              {live.length} match{live.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1.5">
            {live.map((match) => (
              <TournamentMatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      );
    }

    if (upcoming.length > 0) {
      sections.push(
        <div key="upcoming">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
              {t('pages_detail.match.card_status_upcoming')}
            </span>
            <div className="flex-1 h-px bg-[var(--color-border-primary)]/40" />
            <span className="text-xs text-[var(--color-text-muted)]">
              {upcoming.length} match{upcoming.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1.5">
            {upcoming.map((match) => (
              <TournamentMatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      );
    }

    if (finished.length > 0) {
      sections.push(
        <div key="finished">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
              {t('pages_detail.match.card_status_finished')}
            </span>
            <div className="flex-1 h-px bg-[var(--color-border-primary)]/40" />
            <span className="text-xs text-[var(--color-text-muted)]">
              {finished.length} match{finished.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1.5">
            {finished.map((match) => (
              <TournamentMatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      );
    }

    return sections;
  }, [matchesByStatus, t]);

  const memoizedAds = useMemo(() => ads, [ads]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Game Selector - Desktop only */}
      <div className="pt-20 hidden md:block">
        <GameSelector
          games={games}
          selectedGame={selectedGame}
          onSelectionChange={setSelectedGame}
          isLoading={isLoadingGames}
        />
      </div>

      {/* Layout principal avec sidebar publicitaire (desktop) */}
      <div className="pb-8 pt-20 md:pt-0">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            <div className="flex-1 min-w-0">

              {/* ── Header ── */}
              <div className="pt-7 mb-3 space-y-3">
                {/* Title */}
                <div className="flex items-baseline gap-2.5">
                  <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                    {t('pages_detail.match.title')}
                  </h1>
                  <span className="text-xs text-text-muted tabular-nums">
                    {loading ? '···' : sortedMatches.length}
                  </span>
                  <LiquipediaBadge className="ml-auto self-center" />
                </div>

                {/* Actions row: selected date + sort + search + refresh */}
                <div className="flex items-center justify-between gap-3">
                  {/* Left: selected date display */}
                  <div className="flex items-center">
                    <span className="text-xs text-[#F22E62] font-medium">
                      {selectedDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Right: Trier + Search + Refresh */}
                  <div className="flex items-center gap-1.5">
                    {/* Trier dropdown */}
                    <div className="relative" ref={sortRef}>
                      <button
                        onClick={() => setIsSortOpen(prev => !prev)}
                        className={`flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-lg border transition-all ${
                          isSortOpen
                            ? 'text-[#F22E62] border-[#F22E62]/30 bg-[#F22E62]/5'
                            : 'text-text-muted border-border-primary/20 bg-bg-secondary/30 hover:border-border-primary/50 hover:text-text-secondary'
                        }`}
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        <span className="hidden sm:inline">Trier</span>
                      </button>

                      {isSortOpen && (
                        <div className="absolute right-0 top-full mt-1.5 z-50 bg-bg-primary/95 backdrop-blur-md border border-border-primary/40 rounded-xl py-1.5 shadow-2xl shadow-black/30 min-w-[180px]">
                          {([
                            { value: '-begin_at' as const, label: 'Date (récent)' },
                            { value: 'begin_at' as const, label: 'Date (ancien)' },
                          ]).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => { setSortBy(opt.value); setIsSortOpen(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                                sortBy === opt.value
                                  ? 'text-[#F22E62] bg-[#F22E62]/5'
                                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-secondary/30'
                              }`}
                            >
                              <Check className={`w-3 h-3 flex-shrink-0 ${sortBy === opt.value ? 'opacity-100' : 'opacity-0'}`} />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="w-px h-4 bg-border-primary/20 mx-0.5" />

                    {/* Search */}
                    <button
                      onClick={() => setIsSearchModalOpen(true)}
                      className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-text-secondary rounded-lg transition-colors"
                      title="Rechercher (⌘K)"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>

                    {/* Refresh */}
                    <button
                      onClick={handleRefresh}
                      disabled={loading}
                      className="flex items-center justify-center w-7 h-7 text-text-muted hover:text-[#F22E62] disabled:opacity-30 rounded-lg transition-colors"
                      title={t('pages_detail.match.refresh')}
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Calendar ── */}
              <div className="mb-5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevRange}
                    className="flex-shrink-0 p-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary border border-border-primary transition-colors"
                    aria-label={t('pages_detail.match.prev_dates')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex-1 grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-2">
                    {dateRange.map((date, index) => {
                      const isSelected =
                        date.getDate() === selectedDate.getDate() &&
                        date.getMonth() === selectedDate.getMonth() &&
                        date.getFullYear() === selectedDate.getFullYear();
                      const isTodayDate = isToday(date);

                      const hiddenClasses = [
                        index >= 5 && 'hidden sm:flex',
                        index >= 7 && 'sm:hidden md:flex',
                        index >= 9 && 'md:hidden lg:flex'
                      ].filter(Boolean).join(' ');

                      return (
                        <button
                          key={index}
                          onClick={() => handleDateSelect(date)}
                          className={`
                            flex flex-col items-center justify-center p-2 rounded-lg border transition-all
                            ${hiddenClasses}
                            ${isSelected
                              ? 'bg-[#F22E62] text-white border-[#F22E62]'
                              : isTodayDate
                                ? 'bg-bg-tertiary text-text-primary border-[#F22E62]'
                                : 'bg-bg-secondary text-text-muted border-border-primary hover:bg-bg-tertiary'
                            }
                          `}
                        >
                          <span className="text-xs uppercase mb-1">
                            {getDayName(date, locale)}
                          </span>
                          <span className="text-lg font-bold">
                            {date.getDate()}
                          </span>
                          <span className="text-xs capitalize">
                            {getMonthName(date, locale)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleNextRange}
                    className="flex-shrink-0 p-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary border border-border-primary transition-colors"
                    aria-label={t('pages_detail.match.next_dates')}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Message d'erreur */}
              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
                  {error}
                </div>
              )}

              {/* Liste des matchs — key force React à détruire/recréer le DOM à chaque changement de date */}
              <div key={selectedDateStr}>
                {loading ? (
                  <div className="space-y-1.5">
                    {loadingSkeletons}
                  </div>
                ) : sortedMatches.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-text-muted text-lg">
                      {t('pages_detail.match.no_matches')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {matchesList}
                  </div>
                )}
              </div>
            </div>

            {/* Colonne de publicités - Desktop uniquement */}
            {!isSubscribed && (
              <div className="hidden xl:block">
                <div className="sticky top-24">
                  <AdColumn ads={memoizedAds} isLoading={isLoadingAds} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modale de recherche */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent overlayVariant="default" className="w-[98vw] max-w-[1920px] h-[90vh] max-h-[90vh] p-0 gap-0 bg-background border-border-primary/50 flex flex-col [&>button]:hidden">
          <DialogTitle className="sr-only">{t('pages_detail.match.search_title')}</DialogTitle>

          {/* Header de la modale avec barre de recherche */}
          <div className="p-6 border-b border-border-primary/50 bg-background">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pages_detail.match.search_placeholder')}
                  className="w-full pl-12 pr-4 py-3 bg-bg-secondary/50 border border-border-primary/50 rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setIsSearchModalOpen(false);
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {searchQuery && (
              <p className="mt-3 text-sm text-text-muted">
                {t('pages_detail.match.count', { count: filteredMatches.length })}
              </p>
            )}
          </div>

          {/* Contenu scrollable avec résultats */}
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            {!searchQuery ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.match.search_start')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.match.search_placeholder')}</p>
                </div>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.match.search_no_results')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.match.search_try_other')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredMatches.map((match) => (
                  <TournamentMatchCard
                    key={match.id}
                    match={match}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchPage;
