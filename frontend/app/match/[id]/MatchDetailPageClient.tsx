'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Gamepad2,
  Radio,
  Trophy,
  TrendingUp,
  AlertCircle,
  Play,
  Users,
} from 'lucide-react';
import { PandaMatch } from '../../types';
import { matchService } from '../../services/matchService';
import { teamService } from '../../services/teamService';
import { advertisementService } from '../../services/advertisementService';
import { Advertisement } from '../../types';
import AdColumn from '../../components/ads/AdColumn';
import Card from '../../components/ui/Card';
import { SportsEventSchema, BreadcrumbSchema } from '../../components/seo/StructuredData';
import { generateBreadcrumbs } from '../../lib/breadcrumbHelper';

interface MatchDetailPageClientProps {
  matchId: string;
}

export default function MatchDetailPageClient({ matchId }: MatchDetailPageClientProps) {
  const t = useTranslations('pages_detail.match_detail');
  const [match, setMatch] = useState<PandaMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);
  const [teamsData, setTeamsData] = useState<any[]>([]);

  // Charger les publicités
  useEffect(() => {
    const loadAds = async () => {
      try {
        setIsLoadingAds(true);
        const fetchedAds = await advertisementService.getActiveAdvertisements();
        setAds(fetchedAds);
      } catch (error) {
        console.error('Erreur lors du chargement des publicités:', error);
      } finally {
        setIsLoadingAds(false);
      }
    };

    loadAds();
  }, []);

  // Charger le match
  useEffect(() => {
    const loadMatch = async () => {
      try {
        setLoading(true);
        const data = await matchService.getMatchById(matchId);
        setMatch(data);
        console.log('Match Details:', data);

        // Charger les détails des deux équipes si disponibles
        if (data.opponents && data.opponents.length === 2) {
          try {
            const teamIds = data.opponents
              .filter(o => o.opponent)
              .map(o => o.opponent!.id);
            console.log('Loading teams with IDs:', teamIds);

            const teams = await teamService.getTeamsByIds(teamIds);
            console.log('Teams Data:', teams);
            setTeamsData(teams);
          } catch (teamError) {
            console.error('Error loading team details:', teamError);
            // On continue même si le chargement des équipes échoue
          }
        }
      } catch (err) {
        console.error('Error loading match:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement du match');
      } finally {
        setLoading(false);
      }
    };

    if (matchId) {
      loadMatch();
    }
  }, [matchId]);

  const memoizedAds = useMemo(() => ads, [ads]);

  // Format utilities
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-pink-500 border-t-pink-200 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-300">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card variant="outlined" className="p-8 max-w-md">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <p className="text-red-400 font-medium mb-2">{t('error_title')}</p>
              <p className="text-gray-400 text-sm">
                {error || t('not_found')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === homeTeam?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === awayTeam?.id)?.score;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const matchUrl = `${siteUrl}/match/${matchId}`;

  // Breadcrumbs
  const breadcrumbs = generateBreadcrumbs([
    { name: t('breadcrumb_home'), url: '/' },
    { name: t('breadcrumb_live'), url: '/direct' },
    { name: `${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'}`, url: matchUrl },
  ]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Structured Data pour SEO */}
      <SportsEventSchema
        name={`${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'}`}
        description={`${match.videogame?.name || 'Esport'} - ${match.league?.name || ''}`}
        startDate={match.begin_at || new Date().toISOString()}
        endDate={match.end_at || undefined}
        url={matchUrl}
        location={match.tournament?.region || undefined}
        image={homeTeam?.image_url || undefined}
        teams={[
          ...(homeTeam ? [{ name: homeTeam.name, logo: homeTeam.image_url || undefined }] : []),
          ...(awayTeam ? [{ name: awayTeam.name, logo: awayTeam.image_url || undefined }] : []),
        ]}
      />
      <BreadcrumbSchema items={breadcrumbs} />

      {/* Contenu principal */}
      <main className="container mx-auto px-4 py-8 pt-24 md:pt-27">
        <div className="flex gap-8">
          {/* Colonne principale */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* Bannière d'information du match */}
            <section className="space-y-4 mb-12">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#F44576]/20 via-[#091626]/40 to-[#060B13]/60 border-2 border-[#F44576]/40 p-8 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-[#F44576]/10 to-transparent opacity-50" />
                <div className="relative">
                  {/* Ligne 1: Infos détaillées */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* Jeu */}
                    <div className="bg-bg-secondary rounded-lg p-3 border border-border-primary">
                      <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('info_game')}</p>
                      <p className="text-white font-semibold">{match.videogame?.name || '-'}</p>
                    </div>

                    {/* Ligue */}
                    <div className="bg-bg-secondary rounded-lg p-3 border border-border-primary">
                      <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('info_league')}</p>
                      <p className="text-white font-semibold text-sm line-clamp-1">{match.league?.name || '-'}</p>
                    </div>

                    {/* Région */}
                    <div className="bg-bg-secondary rounded-lg p-3 border border-border-primary">
                      <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('info_region')}</p>
                      <p className="text-white font-semibold">{match.tournament?.region || '-'}</p>
                    </div>

                    {/* Date/Heure */}
                    <div className="bg-bg-secondary rounded-lg p-3 border border-border-primary">
                      <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('info_date')}</p>
                      <p className="text-white font-semibold text-sm">{match.begin_at ? formatDate(match.begin_at) : '-'}</p>
                      <p className="text-text-muted text-xs">{match.begin_at ? formatTime(match.begin_at) : '-'}</p>
                    </div>
                  </div>

                  {/* Diviseur */}
                  <div className="h-px bg-gradient-to-r from-transparent via-text-accent to-transparent mb-6" />

                  {/* Ligne 2: Matchup et Score */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 mb-6">
                    {/* Équipe 1 */}
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                      {homeTeam?.image_url && (
                        <img
                          src={homeTeam.image_url}
                          alt={homeTeam.name}
                          className="w-16 h-16 md:w-24 md:h-24 object-contain flex-shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-text-primary text-xs md:text-sm uppercase tracking-wider">{t('team_home')}</p>
                        <p className="text-white font-bold text-lg md:text-xl truncate">{homeTeam?.acronym || homeTeam?.name}</p>
                        <p className="text-text-primary text-xs truncate">{homeTeam?.name}</p>
                      </div>
                    </div>

                    {/* Score central */}
                    <div className="text-center flex-shrink-0">
                      {match.status === 'finished' && homeScore !== undefined && awayScore !== undefined ? (
                        <>
                          <div className="text-4xl md:text-6xl font-black text-white mb-2">
                            {homeScore} - {awayScore}
                          </div>
                          <p className="text-green-400 font-semibold text-sm">{t('status_finished')}</p>
                        </>
                      ) : match.status === 'running' ? (
                        <>
                          <div className="text-3xl md:text-4xl font-black text-red-500 mb-2 animate-pulse">●</div>
                          <p className="text-red-400 font-semibold text-xs md:text-sm">{t('status_running')}</p>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl md:text-4xl font-black text-text-muted mb-2">vs</div>
                          <p className="text-orange-400 font-semibold text-xs md:text-sm">{t('status_upcoming')}</p>
                        </>
                      )}
                      <p className="text-text-muted text-xs mt-2">{t('bo_prefix')}{match.number_of_games}</p>
                    </div>

                    {/* Équipe 2 */}
                    <div className="flex items-center gap-2 md:gap-4 flex-1 flex-row-reverse min-w-0">
                      {awayTeam?.image_url && (
                        <img
                          src={awayTeam.image_url}
                          alt={awayTeam.name}
                          className="w-16 h-16 md:w-24 md:h-24 object-contain flex-shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="text-right min-w-0">
                        <p className="text-text-primary text-xs md:text-sm uppercase tracking-wider">{t('team_away')}</p>
                        <p className="text-white font-bold text-lg md:text-xl truncate">{awayTeam?.acronym || awayTeam?.name}</p>
                        <p className="text-text-primary text-xs truncate">{awayTeam?.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ligne 3: Infos supplémentaires (si applicable) */}
                  {(match.winner || match.number_of_games || match.serie) && (
                    <>
                      <div className="h-px bg-gradient-to-r from-transparent via-text-accent to-transparent my-6" />
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {match.winner && (
                          <div className="bg-bg-secondary rounded-lg p-3 border border-border-primary">
                            <p className="text-text-muted text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Trophy className="w-3 h-3" /> {t('info_winner')}
                            </p>
                            <p className="text-text-accent font-bold">{match.winner.acronym || match.winner.name}</p>
                          </div>
                        )}
                        {match.number_of_games && (
                          <div className="bg-bg-secondary rounded-lg p-3 border border-border-primary">
                            <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('info_games_played')}</p>
                            <p className="text-text-primary font-semibold">{match.games?.length || 0} / {match.number_of_games}</p>
                          </div>
                        )}
                        {match.serie && (
                          <div className="bg-bg-secondary rounded-lg p-3 border border-border-primary">
                            <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('info_series')}</p>
                            <p className="text-text-primary font-semibold text-sm line-clamp-1">{match.serie.full_name || '-'}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Détails des jeux */}
            {match.games && match.games.length > 0 && (
              <section className="space-y-8 mb-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                    <Gamepad2 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary">{t('section_game_details')}</h2>
                </div>

                <div className="space-y-3">
                  {match.games.map((game) => {
                    const gameWinner = game.winner?.id ? match.opponents?.find(o => o.opponent?.id === game.winner?.id)?.opponent : null;
                    return (
                      <Card key={game.id} variant="outlined" className="p-4 bg-bg-secondary border border-border-primary">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-text-primary font-medium">
                              {t('game_label')} {game.position}{' '}
                              <span className={`ml-2 text-sm ${
                                game.status === 'finished' ? 'text-green-400' :
                                game.status === 'running' ? 'text-red-400' :
                                'text-text-secondary'
                              }`}>
                                ({game.status === 'finished' ? t('game_status_finished') : game.status === 'running' ? t('game_status_running') : t('game_status_upcoming')})
                              </span>
                            </p>
                            {game.begin_at && (
                              <p className="text-text-secondary text-sm">
                                {formatTime(game.begin_at)} {game.length && `- ${formatDuration(game.length)}`}
                              </p>
                            )}
                          </div>
                          {gameWinner && (
                            <div className="flex items-center gap-3">
                              {gameWinner.image_url && (
                                <img
                                  src={gameWinner.image_url}
                                  alt={gameWinner.name}
                                  className="w-12 h-12 object-contain"
                                  loading="lazy"
                                />
                              )}
                              <div className="text-right">
                                <p className="text-[#F44576] font-bold">{gameWinner.acronym || gameWinner.name}</p>
                                <p className="text-gray-400 text-xs">{t('game_winner_label')}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Statistiques du match */}
            <section className="space-y-8 mb-12">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">{t('section_statistics')}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Format */}
                <Card variant="outlined" className="p-6 text-center space-y-2">
                  <p className="text-text-secondary text-sm">{t('stat_format')}</p>
                  <p className="text-2xl font-bold text-[#F44576]">
                    BO{match.number_of_games}
                  </p>
                </Card>

                {/* Matchs joués */}
                {match.games && (
                  <Card variant="outlined" className="p-6 text-center space-y-2">
                    <p className="text-text-secondary text-sm">{t('stat_games_played')}</p>
                    <p className="text-2xl font-bold text-[#F44576]">
                      {match.games.length}
                    </p>
                  </Card>
                )}

                {/* Gagnant */}
                {match.winner && (
                  <Card variant="outlined" className="p-6 text-center space-y-2">
                    <p className="text-text-secondary text-sm">{t('stat_winner')}</p>
                    <p className="text-lg font-bold text-[#F44576]">
                      {match.winner.acronym || match.winner.name}
                    </p>
                  </Card>
                )}

                {/* Durée totale */}
                {match.games && match.games.length > 0 && (
                  <Card variant="outlined" className="p-6 text-center space-y-2">
                    <p className="text-text-secondary text-sm">{t('stat_total_duration')}</p>
                    <p className="text-xl font-bold text-[#F44576]">
                      {formatDuration(match.games.reduce((acc, g) => acc + (g.length || 0), 0))}
                    </p>
                  </Card>
                )}
              </div>
            </section>

            {/* Section Teams & Rosters */}
            {match.opponents && match.opponents.length === 2 && teamsData.length === 2 && (
              <section className="space-y-8 mb-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary">{t('section_teams_rosters')}</h2>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {teamsData.map((teamDetail) => {
                    const players = teamDetail.players || [];
                    const activePlayers = players.filter((p: any) => p.active).length;

                    return (
                      <div key={teamDetail.id} className="group">
                        {/* Card background glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#F44576]/10 via-transparent to-[#182859]/10 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>

                        {/* Main card */}
                        <div className="relative bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden backdrop-blur-sm hover:border-[#F44576]/30 transition-all duration-300 flex flex-col h-full">

                          {/* Team Header */}
                          <div className="p-4 border-b border-[#182859]/20 bg-[#182859]/10">
                            <div className="flex items-center gap-4">
                              {/* Team Logo */}
                              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#182859]/50 to-[#060B13]/50 border border-[#182859]/30 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:border-[#F44576]/40 transition-colors">
                                {teamDetail.image_url ? (
                                  <img
                                    src={teamDetail.image_url}
                                    alt={teamDetail.name}
                                    className="w-full h-full object-contain p-1"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Trophy className="w-8 h-8 text-gray-500" />
                                )}
                              </div>

                              {/* Team Info */}
                              <div className="flex-1 text-left">
                                <h3 className="text-lg font-bold text-text-primary group-hover:text-text-accent transition-colors">
                                  {teamDetail.name}
                                </h3>
                                {teamDetail.acronym && (
                                  <p className="text-sm text-[#F44576] font-semibold">
                                    {teamDetail.acronym}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                                  {teamDetail.location && (
                                    <>
                                      <span>{teamDetail.location}</span>
                                      <span className="text-text-secondary">•</span>
                                    </>
                                  )}
                                  <span>{players.length} {players.length > 1 ? t('player_plural') : t('player_singular')}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Players Section */}
                          <div className="p-4">
                            {players.length > 0 ? (
                              <>
                                {/* Players Grid */}
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                                  {players.map((player: any) => (
                                    <div key={player.id} className="group/player cursor-pointer">
                                      {/* Player Avatar */}
                                      <div className="relative mb-2">
                                        <div className="w-full aspect-square rounded-xl bg-bg-secondary border border-border-primary flex items-center justify-center overflow-hidden transition-all duration-300 group-hover/player:border-text-accent group-hover/player:shadow-lg group-hover/player:shadow-text-accent/20">
                                          {player.image_url ? (
                                            <img
                                              src={player.image_url}
                                              alt={player.name}
                                              className="w-full h-full object-cover object-center"
                                              loading="lazy"
                                            />
                                          ) : (
                                            <div className="text-xl font-bold text-text-secondary">
                                              {player.name.split(' ').map((w: string) => w.charAt(0)).join('').substring(0, 2).toUpperCase()}
                                            </div>
                                          )}

                                          {/* Hover overlay */} 
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
                                            <div className="text-center">
                                              {player.role && (
                                                <p className="text-xs font-semibold text-text-accent">
                                                  {player.role}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Player Info */}
                                      <div className="space-y-1">
                                        <p className="text-xs font-bold text-text-primary truncate group-hover/player:text-text-accent transition-colors text-center">
                                          {player.name}
                                        </p>
                                        {player.role && (
                                          <p className="text-xs truncate text-center text-text-accent">
                                            {player.role}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Team Stats */}
                                <div className="border-t border-[#182859]/20 pt-4 grid grid-cols-2 gap-3">
                                  <div className="text-center p-2 bg-[#182859]/10 rounded-lg">
                                    <p className="text-lg font-bold text-[#F44576]">{players.length}</p>
                                    <p className="text-xs text-text-secondary">{t('stat_players')}</p>
                                  </div>
                                  <div className="text-center p-2 bg-[#182859]/10 rounded-lg">
                                    <p className="text-lg font-bold text-green-400">{activePlayers}</p>
                                    <p className="text-xs text-text-secondary">{t('stat_active_players')}</p>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-center py-6">
                                <Trophy className="w-8 h-8 text-text-secondary mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">{t('empty_no_players')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Section Streaming */}
            {match.streams_list && match.streams_list.length > 0 && (
              <section className="space-y-8 mb-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary">{t('section_streaming')}</h2>
                </div>

                {/* Sorted streams */}
                {(() => {
                  const sortedStreams = match.streams_list
                    .sort((a, b) => {
                      if (a.official && !b.official) return -1;
                      if (!a.official && b.official) return 1;
                      if (a.main && !b.main) return -1;
                      if (!a.main && b.main) return 1;
                      return 0;
                    });

                  const selectedStream = sortedStreams[selectedStreamIdx];
                  const isTwitch = selectedStream?.raw_url?.includes('twitch');
                  const isYoutube = selectedStream?.raw_url?.includes('youtube');

                  // Extract Twitch channel name from URL
                  const getTwitchChannel = (url: string) => {
                    const match = url.match(/twitch\.tv\/([^/?]+)/);
                    return match ? match[1] : '';
                  };

                  // Extract YouTube video ID from URL
                  const getYoutubeId = (url: string) => {
                    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&/?]+)/);
                    return match ? match[1] : '';
                  };

                  return (
                    <div className="space-y-4">
                      {/* Iframe Player */}
                      {(isTwitch || isYoutube) && (
                        <div className="relative w-full bg-black rounded-xl overflow-hidden border-2 border-[#182859]/40">
                          <div className="relative" style={{ paddingBottom: '56.25%' }}>
                            {isTwitch ? (
                              <iframe
                                src={`https://player.twitch.tv/?channel=${getTwitchChannel(selectedStream.raw_url)}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`}
                                height="100%"
                                width="100%"
                                allowFullScreen
                                className="absolute top-0 left-0 w-full h-full"
                                allow="autoplay"
                              />
                            ) : isYoutube ? (
                              <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${getYoutubeId(selectedStream.raw_url)}`}
                                title="YouTube video player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="absolute top-0 left-0 w-full h-full border-none"
                              />
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* Stream selector buttons */}
                      <div className="space-y-2">
                        {sortedStreams.map((stream, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedStreamIdx(idx)}
                            className={`w-full text-left transition-colors duration-300 rounded-xl border-2 border-border-primary p-4 flex items-center justify-between ${
                              selectedStreamIdx === idx
                                ? stream.official
                                  ? 'bg-gradient-to-r from-[#F44576]/30 to-pink-500/20 border-[#F44576]/70'
                                  : stream.main
                                  ? 'bg-gradient-to-r from-red-500/30 to-orange-500/20 border-red-500/70'
                                  : 'bg-gradient-to-r from-[#091626]/60 to-[#060B13]/80 border-[#F44576]/50'
                                : stream.official
                                ? 'bg-gradient-to-r from-[#F44576]/20 to-pink-500/10 border-[#F44576]/50'
                                : stream.main
                                ? 'bg-gradient-to-r from-red-500/20 to-orange-500/10 border-red-500/40'
                                : 'bg-gradient-to-r from-[#091626]/40 to-[#060B13]/60 border-[#182859]/40'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                stream.main ? 'bg-red-500 animate-pulse' :
                                stream.official ? 'bg-[#F44576] animate-pulse' :
                                'bg-gray-500'
                              }`} />
                              <div>
                                <p className="text-white font-bold text-lg">
                                  {stream.official && t('stream_official') + ' '}
                                  {stream.main && t('stream_main') + ' '}
                                  {stream.language.toUpperCase()}
                                </p>
                                <p className="text-texte-secondary text-sm">
                                  {stream.raw_url.includes('twitch') ? t('platform_twitch') : stream.raw_url.includes('youtube') ? t('platform_youtube') : t('stream_fallback')}
                                </p>
                              </div>
                            </div>
                            {selectedStreamIdx === idx ? (
                              <div className="text-text-accent font-bold">{t('stream_status_playing')}</div>
                            ) : (
                              <Play className="w-6 h-6 text-text-accent" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Fallback link if not Twitch/YouTube */}
                      {(!isTwitch && !isYoutube) && (
                        <a
                          href={selectedStream.raw_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#F44576] to-pink-600 hover:from-[#F44576]/90 hover:to-pink-600/90 text-white rounded-xl font-semibold transition-colors"
                        >
                          <Play className="w-5 h-5" />
                          {t('stream_link_text')} {selectedStream.raw_url.split('/')[2]}
                        </a>
                      )}
                    </div>
                  );
                })()}
              </section>
            )}

          </div>

          {/* Colonne publicitaire */}
          <AdColumn
            ads={memoizedAds}
            isSubscribed={isSubscribed}
            isLoading={isLoadingAds}
          />
        </div>
      </main>
    </div>
  );
}
