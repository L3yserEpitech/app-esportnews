'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Gamepad2,
  Radio,
  Trophy,
  TrendingUp,
  AlertCircle,
  Play,
} from 'lucide-react';
import { PandaMatch } from '../../types';
import { matchService } from '../../services/matchService';
import { advertisementService } from '../../services/advertisementService';
import { Advertisement } from '../../types';
import AdColumn from '../../components/ads/AdColumn';
import Card from '../../components/ui/Card';

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = params.id as string;

  const [match, setMatch] = useState<PandaMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);

  const esportBackgrounds = [
    'https://images.unsplash.com/photo-1587095951604-b9d924a3fda0?q=80&w=3132&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://images.pexels.com/photos/7862518/pexels-photo-7862518.jpeg',
    'https://images.pexels.com/photos/14266493/pexels-photo-14266493.jpeg',
    'https://images.pexels.com/photos/7915216/pexels-photo-7915216.jpeg',
    'https://images.pexels.com/photos/7849513/pexels-photo-7849513.jpeg',
  ];

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
          <p className="text-gray-300">Chargement du match...</p>
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
              <p className="text-red-400 font-medium mb-2">Erreur</p>
              <p className="text-gray-400 text-sm">
                {error || 'Match non trouvé'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const backgroundImage = esportBackgrounds[match.id % esportBackgrounds.length];
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === homeTeam?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === awayTeam?.id)?.score;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero Section - Simplified background only */}
      

      {/* Contenu principal */}
      <main className="container mx-auto px-4 py-8 pt-24 md:pt-27">
        <div className="flex gap-8">
          {/* Colonne principale */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* Bannière d'information du match */}
            <section className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#F44576]/20 via-[#091626]/40 to-[#060B13]/60 border-2 border-[#F44576]/40 p-8 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-[#F44576]/10 to-transparent opacity-50" />
                <div className="relative">
                  {/* Ligne 1: Infos détaillées */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* Jeu */}
                    <div className="bg-[#060B13]/40 rounded-lg p-3 border border-[#182859]/30">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Jeu</p>
                      <p className="text-white font-semibold">{match.videogame?.name || '-'}</p>
                    </div>

                    {/* Ligue */}
                    <div className="bg-[#060B13]/40 rounded-lg p-3 border border-[#182859]/30">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Ligue</p>
                      <p className="text-white font-semibold text-sm line-clamp-1">{match.league?.name || '-'}</p>
                    </div>

                    {/* Région */}
                    <div className="bg-[#060B13]/40 rounded-lg p-3 border border-[#182859]/30">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Région</p>
                      <p className="text-white font-semibold">{match.tournament?.region || '-'}</p>
                    </div>

                    {/* Date/Heure */}
                    <div className="bg-[#060B13]/40 rounded-lg p-3 border border-[#182859]/30">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Date</p>
                      <p className="text-white font-semibold text-sm">{formatDate(match.begin_at)}</p>
                      <p className="text-gray-400 text-xs">{formatTime(match.begin_at)}</p>
                    </div>
                  </div>

                  {/* Diviseur */}
                  <div className="h-px bg-gradient-to-r from-transparent via-[#F44576]/40 to-transparent mb-6" />

                  {/* Ligne 2: Matchup et Score */}
                  <div className="flex items-center justify-between gap-8 mb-6">
                    {/* Équipe 1 */}
                    <div className="flex items-center gap-4 flex-1">
                      {homeTeam?.image_url && (
                        <img
                          src={homeTeam.image_url}
                          alt={homeTeam.name}
                          className="w-24 h-24 object-contain"
                          loading="lazy"
                        />
                      )}
                      <div>
                        <p className="text-gray-400 text-sm uppercase tracking-wider">Home</p>
                        <p className="text-white font-bold text-xl">{homeTeam?.acronym || homeTeam?.name}</p>
                        <p className="text-gray-400 text-xs">{homeTeam?.name}</p>
                      </div>
                    </div>

                    {/* Score central */}
                    <div className="text-center">
                      {match.status === 'finished' && homeScore !== undefined && awayScore !== undefined ? (
                        <>
                          <div className="text-6xl font-black text-white mb-2">
                            {homeScore} - {awayScore}
                          </div>
                          <p className="text-green-400 font-semibold text-sm">Terminé</p>
                        </>
                      ) : match.status === 'running' ? (
                        <>
                          <div className="text-4xl font-black text-red-500 mb-2 animate-pulse">●</div>
                          <p className="text-red-400 font-semibold text-sm">EN DIRECT</p>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl font-black text-gray-400 mb-2">vs</div>
                          <p className="text-orange-400 font-semibold text-sm">À venir</p>
                        </>
                      )}
                      <p className="text-gray-400 text-xs mt-2">BO{match.number_of_games}</p>
                    </div>

                    {/* Équipe 2 */}
                    <div className="flex items-center gap-4 flex-1 flex-row-reverse">
                      {awayTeam?.image_url && (
                        <img
                          src={awayTeam.image_url}
                          alt={awayTeam.name}
                          className="w-24 h-24 object-contain"
                          loading="lazy"
                        />
                      )}
                      <div className="text-right">
                        <p className="text-gray-400 text-sm uppercase tracking-wider">Away</p>
                        <p className="text-white font-bold text-xl">{awayTeam?.acronym || awayTeam?.name}</p>
                        <p className="text-gray-400 text-xs">{awayTeam?.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ligne 3: Infos supplémentaires (si applicable) */}
                  {(match.winner || match.number_of_games || match.serie) && (
                    <>
                      <div className="h-px bg-gradient-to-r from-transparent via-[#F44576]/40 to-transparent my-6" />
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {match.winner && (
                          <div className="bg-[#F44576]/10 rounded-lg p-3 border border-[#F44576]/30">
                            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Trophy className="w-3 h-3" /> Vainqueur
                            </p>
                            <p className="text-[#F44576] font-bold">{match.winner.acronym || match.winner.name}</p>
                          </div>
                        )}
                        {match.number_of_games && (
                          <div className="bg-[#060B13]/40 rounded-lg p-3 border border-[#182859]/30">
                            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Matchs joués</p>
                            <p className="text-white font-semibold">{match.games?.length || 0} / {match.number_of_games}</p>
                          </div>
                        )}
                        {match.serie && (
                          <div className="bg-[#060B13]/40 rounded-lg p-3 border border-[#182859]/30">
                            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Série</p>
                            <p className="text-white font-semibold text-sm line-clamp-1">{match.serie.full_name || '-'}</p>
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
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                    <Gamepad2 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Détails des jeux</h2>
                </div>

                <div className="space-y-3">
                  {match.games.map((game) => {
                    const gameWinner = game.winner?.id ? match.opponents?.find(o => o.opponent.id === game.winner?.id)?.opponent : null;
                    return (
                      <Card key={game.id} variant="outlined" className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-white font-medium">
                              Game {game.position}{' '}
                              <span className={`ml-2 text-sm ${
                                game.status === 'finished' ? 'text-green-400' :
                                game.status === 'running' ? 'text-red-400' :
                                'text-gray-400'
                              }`}>
                                ({game.status === 'finished' ? '✓ Terminé' : game.status === 'running' ? '● En direct' : '○ À venir'})
                              </span>
                            </p>
                            {game.begin_at && (
                              <p className="text-gray-400 text-sm">
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
                                <p className="text-gray-400 text-xs">Gagnant</p>
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
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Statistiques</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Format */}
                <Card variant="outlined" className="p-6 text-center space-y-2">
                  <p className="text-gray-400 text-sm">Format</p>
                  <p className="text-2xl font-bold text-[#F44576]">
                    BO{match.number_of_games}
                  </p>
                </Card>

                {/* Matchs joués */}
                {match.games && (
                  <Card variant="outlined" className="p-6 text-center space-y-2">
                    <p className="text-gray-400 text-sm">Matchs joués</p>
                    <p className="text-2xl font-bold text-[#F44576]">
                      {match.games.length}
                    </p>
                  </Card>
                )}

                {/* Gagnant */}
                {match.winner && (
                  <Card variant="outlined" className="p-6 text-center space-y-2">
                    <p className="text-gray-400 text-sm">Gagnant</p>
                    <p className="text-lg font-bold text-[#F44576]">
                      {match.winner.acronym || match.winner.name}
                    </p>
                  </Card>
                )}

                {/* Durée totale */}
                {match.games && match.games.length > 0 && (
                  <Card variant="outlined" className="p-6 text-center space-y-2">
                    <p className="text-gray-400 text-sm">Durée totale</p>
                    <p className="text-xl font-bold text-[#F44576]">
                      {formatDuration(match.games.reduce((acc, g) => acc + (g.length || 0), 0))}
                    </p>
                  </Card>
                )}
              </div>
            </section>

            {/* Section Streaming */}
            {match.streams_list && match.streams_list.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Flux de Diffusion</h2>
                </div>

                <div className="space-y-3">
                  {match.streams_list
                    .sort((a, b) => {
                      // Les flux officiels en premier, puis les flux principaux
                      if (a.official && !b.official) return -1;
                      if (!a.official && b.official) return 1;
                      if (a.main && !b.main) return -1;
                      if (!a.main && b.main) return 1;
                      return 0;
                    })
                    .map((stream, idx) => (
                    <a
                      key={idx}
                      href={stream.raw_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <div className={`relative overflow-hidden rounded-xl border-2 p-5 transition-colors duration-300 flex items-center justify-between cursor-pointer ${
                        stream.official
                          ? 'bg-gradient-to-r from-[#F44576]/20 to-pink-500/10 border-[#F44576]/50 hover:border-[#F44576]/70'
                          : stream.main
                          ? 'bg-gradient-to-r from-red-500/20 to-orange-500/10 border-red-500/40 hover:border-red-500/60'
                          : 'bg-gradient-to-r from-[#091626]/40 to-[#060B13]/60 border-[#182859]/40 hover:border-[#F44576]/30'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            stream.main ? 'bg-red-500 animate-pulse' :
                            stream.official ? 'bg-[#F44576] animate-pulse' :
                            'bg-gray-500'
                          }`} />
                          <div>
                            <p className="text-white font-bold text-lg">
                              {stream.official && '⭐ Flux Officiel '}
                              {stream.main && '🔴 Flux Principal '}
                              {stream.language.toUpperCase()}
                            </p>
                            <p className="text-gray-300 text-sm">
                              {stream.raw_url.includes('twitch') ? 'Twitch' : 'Voir le flux'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Play className="w-6 h-6 text-[#F44576] group-hover:scale-125 transition-transform" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
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
