'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpDown, Check } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { PandaTournament, Advertisement } from '../types';
import { advertisementService } from '../services/advertisementService';
import { tournamentService } from '../services/tournamentService';
import TournamentCard from '../components/tournaments/TournamentCard';
import GameSelector from '../components/games/GameSelector';
import AdColumn from '../components/ads/AdColumn';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

// --- Date utilities (from MatchPageClient) ---

const useVisibleDatesCount = (): number => {
  const [count, setCount] = useState(11);

  useEffect(() => {
    const getCount = () => {
      if (typeof window === 'undefined') return 11;
      const width = window.innerWidth;
      if (width < 640) return 5;
      if (width < 768) return 7;
      if (width < 1024) return 9;
      return 11;
    };

    setCount(getCount());
    const handleResize = () => setCount(getCount());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return count;
};

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
  };
  const lang = locale.startsWith('fr') ? 'fr' : 'en';
  return dayNames[lang][date.getDay()];
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

const isSameDay = (a: Date, b: Date): boolean => {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
};

const generateDateRange = (centerDate: Date, offset: number = 0, visibleCount: number = 11): Date[] => {
  const dates: Date[] = [];
  const adjustedCenter = new Date(centerDate);
  adjustedCenter.setDate(adjustedCenter.getDate() + offset * visibleCount);

  const halfRange = 5;
  for (let i = -halfRange; i <= halfRange; i++) {
    const date = new Date(adjustedCenter);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
};

// --- Component ---

const TournamentsPage: React.FC = () => {
  const t = useTranslations();
  const { selectedGame, games, isLoadingGames: gamesLoading, setSelectedGame, getSelectedGameData } = useGame();
  const [tournaments, setTournaments] = useState<PandaTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);

  // Status tabs (active when no date is selected)
  const [status, setStatus] = useState<'running' | 'upcoming' | 'finished'>('running');

  // Sort
  const [sortBy, setSortBy] = useState<'tier' | '-tier' | 'begin_at' | '-begin_at'>('tier');

  // Date calendar
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateRangeOffset, setDateRangeOffset] = useState(0);
  const visibleDatesCount = useVisibleDatesCount();

  // Tier filters
  const [tierFilters, setTierFilters] = useState<{ tiers: string[] }>({ tiers: [] });

  // Search
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const selectedGameData = useMemo(() => getSelectedGameData(), [getSelectedGameData]);
  const memoizedGames = useMemo(() => games, [games]);
  const memoizedAds = useMemo(() => ads, [ads]);

  // Date range for calendar
  const dateRange = useMemo(
    () => generateDateRange(new Date(), dateRangeOffset, visibleDatesCount),
    [dateRangeOffset, visibleDatesCount]
  );

  // Fetch tournaments
  const loadTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      let data: PandaTournament[];

      if (selectedDate) {
        // Date mode: fetch tournaments active on that date
        const dateStr = formatDateToYYYYMMDD(selectedDate);
        const gameAcronym = selectedGameData?.acronym;
        data = await tournamentService.getTournamentsByDate(dateStr, gameAcronym);
      } else {
        // Status mode: fetch by status (running/upcoming/finished)
        let endpoint = '/api/tournaments';
        if (status === 'upcoming') endpoint = '/api/tournaments/upcoming';
        else if (status === 'finished') endpoint = '/api/tournaments/finished';

        const params = new URLSearchParams();
        params.append('sort', sortBy);
        if (selectedGame && selectedGameData?.acronym) {
          params.append('game', selectedGameData.acronym);
        }

        const response = await fetch(`${baseUrl}${endpoint}?${params.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to fetch tournaments');
        data = await response.json();
      }

      setTournaments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError(t('pages_detail.tournaments.error_loading'));
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [status, sortBy, selectedGame, selectedGameData, selectedDate, t]);

  // Load ads
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

  // Reload on dependency change
  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Keyboard shortcut for search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Client-side tier filtering
  const filteredTournaments = useMemo(() => {
    let result = tournaments;
    if (tierFilters.tiers.length > 0) {
      result = result.filter(t => tierFilters.tiers.includes(t.tier?.toLowerCase() || ''));
    }
    return result;
  }, [tournaments, tierFilters]);

  // Search filtering (on already tier-filtered results)
  const searchedTournaments = useMemo(() => {
    if (!searchQuery.trim()) return filteredTournaments;
    const query = searchQuery.toLowerCase().trim();
    return filteredTournaments.filter((tournament) => {
      return (
        tournament.name?.toLowerCase().includes(query) ||
        tournament.slug?.toLowerCase().includes(query) ||
        tournament.tier?.toLowerCase().includes(query) ||
        tournament.region?.toLowerCase().includes(query) ||
        tournament.league?.name?.toLowerCase().includes(query) ||
        tournament.videogame?.name?.toLowerCase().includes(query) ||
        tournament.status?.toLowerCase().includes(query)
      );
    });
  }, [filteredTournaments, searchQuery]);

  // Handlers
  const handleRefresh = useCallback(() => {
    loadTournaments();
  }, [loadTournaments]);

  const handleStatusChange = useCallback((newStatus: 'running' | 'upcoming' | 'finished') => {
    setSelectedDate(null); // deselect date → switch to status mode
    setStatus(newStatus);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    // Toggle: click same date = deselect
    setSelectedDate(prev => (prev && isSameDay(prev, date) ? null : date));
  }, []);

  const handlePrevRange = useCallback(() => {
    setDateRangeOffset(prev => prev - 1);
  }, []);

  const handleNextRange = useCallback(() => {
    setDateRangeOffset(prev => prev + 1);
  }, []);

  const handleTierToggle = useCallback((tier: string) => {
    setTierFilters(prev => ({
      tiers: prev.tiers.includes(tier)
        ? prev.tiers.filter(t => t !== tier)
        : [...prev.tiers, tier]
    }));
  }, []);

  // Loading skeletons
  const loadingSkeletons = useMemo(() =>
    [...Array(8)].map((_, index) => (
      <div key={`skeleton-${index}`} className="flex overflow-hidden rounded-xl border border-border-primary/30 bg-bg-secondary animate-pulse">
        <div className="flex flex-1 items-center px-5 py-4 gap-4">
          <div className="w-8 h-5 rounded bg-bg-tertiary flex-shrink-0" />
          <div className="w-12 h-12 rounded-lg bg-bg-tertiary/60 flex-shrink-0 hidden sm:block" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-bg-tertiary rounded w-3/5" />
            <div className="h-3 bg-bg-tertiary rounded w-2/5" />
          </div>
          <div className="h-4 bg-bg-tertiary rounded w-20 hidden sm:block" />
        </div>
      </div>
    )), []);

  // Tournaments grid
  const tournamentsGrid = useMemo(() =>
    filteredTournaments.map((tournament) => (
      <TournamentCard
        key={tournament.id}
        tournament={tournament}
        showGameBadge={!selectedGameData}
      />
    )), [filteredTournaments, selectedGameData]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Game Selector - Desktop only */}
      <div className="pt-20 hidden md:block">
        <GameSelector
          games={memoizedGames}
          selectedGame={selectedGame}
          onSelectionChange={setSelectedGame}
          isLoading={gamesLoading}
        />
      </div>

      {/* Main content */}
      <div className="pb-8 pt-20 md:pt-0">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            <div className="flex-1 min-w-0">
              {/* ── Header ── */}
              <div className="pt-7 mb-3 space-y-3">
                {/* Title */}
                <div className="flex items-baseline gap-2.5">
                  <h1 className="text-2xl font-bold text-text-primary tracking-tight">Tournois</h1>
                  <span className="text-xs text-text-muted tabular-nums">
                    {loading ? '···' : filteredTournaments.length}
                  </span>
                </div>

                {/* Status tabs + Actions */}
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Status tabs with underline */}
                  <div className="flex items-center">
                    {(['running', 'upcoming', 'finished'] as const).map((s) => {
                      const isActive = !selectedDate && status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          className={`relative px-3 py-1.5 text-xs font-semibold transition-colors ${
                            isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                          }`}
                        >
                          {t(`pages_detail.tournaments.status_${s}`)}
                          {isActive && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-[#F22E62] rounded-full" />
                          )}
                        </button>
                      );
                    })}
                    {selectedDate && (
                      <span className="ml-2 text-xs text-[#F22E62] font-medium">
                        {selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* Right: Filtrer + Trier + Search + Refresh */}
                  <div className="flex items-center gap-1.5">
                    {/* Filtrer dropdown */}
                    <div className="relative" ref={filterRef}>
                      <button
                        onClick={() => { setIsFilterOpen(prev => !prev); setIsSortOpen(false); }}
                        className={`flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-lg border transition-all ${
                          isFilterOpen || tierFilters.tiers.length > 0
                            ? 'text-[#F22E62] border-[#F22E62]/30 bg-[#F22E62]/5'
                            : 'text-text-muted border-border-primary/20 bg-bg-secondary/30 hover:border-border-primary/50 hover:text-text-secondary'
                        }`}
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span className="hidden sm:inline">Filtrer</span>
                        {tierFilters.tiers.length > 0 && (
                          <span className="w-4 h-4 rounded-full bg-[#F22E62] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                            {tierFilters.tiers.length}
                          </span>
                        )}
                      </button>

                      {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-1.5 z-50 bg-bg-primary/95 backdrop-blur-md border border-border-primary/40 rounded-xl p-3 shadow-2xl shadow-black/30 min-w-[220px]">
                          <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2.5 px-0.5">Tier</p>
                          <div className="flex gap-1.5">
                            {(['s', 'a', 'b', 'c', 'd'] as const).map((tier) => {
                              const isActive = tierFilters.tiers.includes(tier);
                              return (
                                <button
                                  key={tier}
                                  onClick={() => handleTierToggle(tier)}
                                  className={`w-9 h-9 rounded-lg text-xs font-extrabold uppercase transition-all ${
                                    isActive
                                      ? 'text-white ring-1 ring-white/10 shadow-md'
                                      : 'text-text-muted bg-bg-tertiary/30 border border-border-primary/20 hover:bg-bg-tertiary/60'
                                  }`}
                                  style={isActive ? { backgroundColor: `var(--color-tier-${tier})` } : undefined}
                                >
                                  {tier.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                          {tierFilters.tiers.length > 0 && (
                            <button
                              onClick={() => setTierFilters({ tiers: [] })}
                              className="mt-2.5 text-[10px] text-text-muted hover:text-[#F22E62] transition-colors w-full text-left px-0.5"
                            >
                              Réinitialiser les filtres
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Trier dropdown */}
                    <div className="relative" ref={sortRef}>
                      <button
                        onClick={() => { setIsSortOpen(prev => !prev); setIsFilterOpen(false); }}
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
                            { value: 'tier' as const, label: 'Tier (S → D)' },
                            { value: '-tier' as const, label: 'Tier (D → S)' },
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
                      title={loading ? t('pages_detail.tournaments.loading_button') : t('pages_detail.tournaments.refresh_button')}
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
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex-1 grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-2">
                    {dateRange.map((date, index) => {
                      const isSelected = selectedDate !== null && isSameDay(date, selectedDate);
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
                            {getDayName(date, 'fr')}
                          </span>
                          <span className="text-lg font-bold">
                            {date.getDate()}
                          </span>
                          <span className="text-xs capitalize">
                            {getMonthName(date, 'fr')}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleNextRange}
                    className="flex-shrink-0 p-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary border border-border-primary transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Tournament content */}
              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                    <p className="text-red-600">{error}</p>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex flex-col gap-3">
                  {loadingSkeletons}
                </div>
              ) : filteredTournaments.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {tournamentsGrid}
                </div>
              ) : (
                <div className="bg-bg-secondary rounded-lg border border-border-primary p-12 text-center">
                  <div className="text-text-secondary mb-4">
                    <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">
                    {t('pages_detail.tournaments.no_tournaments')}
                  </h3>
                  <p className="text-text-secondary mb-4">
                    {tierFilters.tiers.length > 0
                      ? 'Aucun tournoi ne correspond aux filtres sélectionnés.'
                      : 'Aucun tournoi trouvé.'}
                  </p>
                  {tierFilters.tiers.length > 0 && (
                    <button
                      onClick={() => setTierFilters({ tiers: [] })}
                      className="px-4 py-2 bg-accent hover:bg-accent/80 text-text-inverse rounded-lg font-medium transition-colors"
                    >
                      {t('pages_detail.tournaments.reset_button')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Ad column (desktop only) */}
            <AdColumn className="mt-8"
              ads={memoizedAds}
              isSubscribed={isSubscribed}
              isLoading={isLoadingAds}
            />
          </div>
        </div>
      </div>

      {/* Search modal */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent overlayVariant="default" className="max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] p-0 gap-0 bg-background border-border-primary/50 flex flex-col [&>button]:hidden">
          <DialogTitle className="sr-only">{t('pages_detail.tournaments.search.placeholder')}</DialogTitle>
          <div className="p-6 border-b border-border-primary/50 bg-background">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pages_detail.tournaments.search.input_placeholder')}
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
                {searchedTournaments.length} {searchedTournaments.length === 1 ? t('pages_detail.tournaments.search.result_singular') : t('pages_detail.tournaments.search.result_plural')}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-background">
            {!searchQuery ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.tournaments.search.start_typing')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.tournaments.search.search_by')}</p>
                </div>
              </div>
            ) : searchedTournaments.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.tournaments.search.no_results')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.tournaments.search.try_other_keywords')}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {searchedTournaments.map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    showGameBadge={!selectedGameData}
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

export default TournamentsPage;
