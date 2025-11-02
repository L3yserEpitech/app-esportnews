'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Gamepad2,
  Calendar,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
  Info,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { PandaTournament, PandaMatch } from '../../types';
import { tournamentService } from '../../services/tournamentService';
import { matchService } from '../../services/matchService';
import { advertisementService } from '../../services/advertisementService';
import { Advertisement } from '../../types';
import AdColumn from '../../components/ads/AdColumn';
import TeamsRosters from '../../components/tournaments/TeamsRosters';
import TournamentStats from '../../components/tournaments/TournamentStats';
import PandaMatchCard from '../../components/matches/PandaMatchCard';
import Card from '../../components/ui/Card';

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<PandaTournament | null>(null);
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
    'https://images.pexels.com/photos/7862508/pexels-photo-7862508.jpeg',
    'https://images.pexels.com/photos/6125333/pexels-photo-6125333.jpeg',
    'https://images.pexels.com/photos/2263410/pexels-photo-2263410.jpeg',
    'https://images.pexels.com/photos/9072317/pexels-photo-9072317.jpeg',
    'https://senet-cloud.s3.eu-central-1.amazonaws.com/assets/images/601aee0379b57/keyarena_seattle.jpg',
    'https://t4.ftcdn.net/jpg/05/70/24/67/360_F_570246739_Kg1bu2gzoCYziBgt0KqKYi9HJPm8Ndqz.jpg',
    'https://images.stockcake.com/public/b/f/6/bf67663c-009e-45a9-9c58-eac8767d3d50_large/epic-gaming-event-stockcake.jpg',
    'https://senet-cloud.s3.eu-central-1.amazonaws.com/assets/images/6064a55c9a5d7/lol_park_esports_stadium.jpg',
    'https://official.garena.com/sg/v1/config/gallery_esport01.jpg',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTjhMR9ABK5pjusiu0gxvHJuG3xOxIFfPfG6Q&s',
    'https://images.stockcake.com/public/3/0/a/30a65fff-8037-498e-8eb8-2c6d8e9fdc7f_large/gaming-tournament-action-stockcake.jpg',
    'https://t4.ftcdn.net/jpg/05/70/24/67/360_F_570246736_xICutjsnExPt1v9DP2XebD7GtCDoMsIb.jpg',
    'https://t4.ftcdn.net/jpg/05/97/50/07/360_F_597500737_MAhUxiVskdhrjNSIb9jbz0Otmw9rvmaO.jpg',
    'https://imageio.forbes.com/specials-images/imageserve/5e0f8f19db7a9600065d7cec/photo-of-an-esports-arena/960x0.jpg?format=jpg&width=960',
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

  // Charger le tournoi
  useEffect(() => {
    const loadTournament = async () => {
      try {
        setLoading(true);
        const data = await tournamentService.getTournamentById(tournamentId);
        setTournament(data);

        // Charger les détails complets de chaque match
        if (data.matches && data.matches.length > 0) {
          console.log(`📦 Loading details for ${data.matches.length} matches...`);
          const matchIds = data.matches.map((m) => m.id);

          try {
            const enrichedMatches = await matchService.getMatchesByIds(matchIds);
            // Remplacer les matchs avec les données enrichies
            setTournament((prevTournament) => {
              if (!prevTournament) return prevTournament;
              return {
                ...prevTournament,
                matches: enrichedMatches,
              };
            });
            console.log('✅ All match details loaded');
          } catch (matchError) {
            console.error('Error loading match details, using basic tournament data:', matchError);
            // On continue avec les données de base du tournoi si le chargement détaillé échoue
          }
        }
      } catch (err) {
        console.error('Error loading tournament:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    if (tournamentId) {
      loadTournament();
    }
  }, [tournamentId]);

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

  const getTierColor = (tier: string) => {
    const colors: { [key: string]: string } = {
      's': 'bg-yellow-500 text-gray-950',
      'a': 'bg-blue-500 text-white',
      'b': 'bg-green-500 text-white',
      'c': 'bg-purple-500 text-white',
      'd': 'bg-gray-500 text-white',
    };
    return colors[tier.toLowerCase()] || colors['d'];
  };

  const getTournamentStatus = () => {
    if (!tournament) return null;
    const now = new Date();
    const begin = new Date(tournament.begin_at);
    const end = new Date(tournament.end_at || tournament.begin_at);

    if (now < begin) return 'À venir';
    if (now > end) return 'Terminé';
    return 'En cours';
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-pink-500 border-t-pink-200 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-300">Chargement du tournoi...</p>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card variant="outlined" className="p-8 max-w-md">
          <p className="text-red-400 text-center">
            {error || 'Tournoi non trouvé'}
          </p>
        </Card>
      </div>
    );
  }

  const status = getTournamentStatus();

  // Sélectionner une image aléatoire basée sur l'ID du tournoi (cohérent à chaque rendu)
  const backgroundImage = esportBackgrounds[tournament.id % esportBackgrounds.length];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero Section */}
      <div className="relative w-full h-96 overflow-hidden mt-20">
        {/* Image de fond */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${backgroundImage})`,
          }}
        />

        {/* Dégradé fondu de haut en bas vers le reste du site */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/60 to-gray-950/95" />

        {/* Overlay supplémentaire pour plus de contraste */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/80 via-gray-950/40 to-gray-950/80" />

        {/* Effets de lumière (rose/bleu) */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        </div>

        {/* Contenu du hero */}
        <div className="relative h-full flex flex-col justify-center container mx-auto px-4">
          <div className="space-y-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase ${getTierColor(tournament.tier)}`}>
                Tier {tournament.tier.toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${status === 'En cours' ? 'bg-red-500/20 text-red-400' :
                status === 'À venir' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                {status}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400">
                {tournament.region}
              </span>
            </div>

            {/* Titre */}
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
              {tournament.name}
            </h1>

            {/* Sous-titre et infos */}
            <div className="space-y-2">
              <p className="text-xl text-gray-300">
                {tournament.league.name}
              </p>
              <p className="text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(tournament.begin_at)} - {formatDate(tournament.end_at || tournament.begin_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <main className="container mx-auto px-4 py-8 pt-24 md:pt-27">
        <div className="flex gap-8">
          {/* Colonne principale */}
          <div className="flex-1 min-w-0 space-y-12">

            {/* Statistiques du tournoi - Design moderne avec effets de fond */}
            <section className="relative space-y-8">
              {/* Effets de fond inspirés de la page login */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl">
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#F22E62]/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F22E62]/10 rounded-full blur-3xl"></div>
              </div>

              {/* Overlay avec dégradé */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#060B13]/60 via-[#091626]/40 to-[#060B13]/60 rounded-3xl"></div>

              {/* Contenu avec backdrop blur */}
              <div className="relative bg-[#091626]/30 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-[#182859]/30">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                    <span className="w-8 h-8 bg-gradient-to-r from-[#F22E62] to-pink-400 rounded-lg flex items-center justify-center shadow-lg shadow-[#F22E62]/20">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </span>
                    Statistiques du Tournoi
                  </h2>
                  <p className="text-gray-400">Vue d'ensemble des performances et données clés</p>
                </div>

                {/* Grille principale des statistiques */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Équipes */}
                  <div className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F44576]/20 to-[#F44576]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                    <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 text-center hover:border-[#F44576]/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
                      <div className="space-y-3">
                        <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-xl flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-3xl font-bold text-[#F44576]">
                          {tournament.teams.length}
                        </div>
                        <p className="text-gray-300 font-medium">Équipes</p>
                        <div className="text-xs text-gray-400 bg-[#091626]/50 rounded-lg px-3 py-1 border border-[#182859]/30">
                          {tournament.expected_roster.length} rosters confirmés
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Matchs */}
                  <div className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F44576]/20 to-[#F44576]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                    <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 text-center hover:border-[#F44576]/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
                      <div className="space-y-3">
                        <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-xl flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                          <Gamepad2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-3xl font-bold text-[#F44576]">
                          {tournament.matches.length}
                        </div>
                        <p className="text-gray-300 font-medium">Matchs</p>
                        <div className="text-xs text-gray-400 bg-[#091626]/50 rounded-lg px-3 py-1 border border-[#182859]/30">
                          {tournament.matches.filter(m => m.number_of_games > 1).length} en BO{tournament.matches[0]?.number_of_games || 3}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Matchs terminés */}
                  <div className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F44576]/20 to-[#F44576]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                    <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 text-center hover:border-[#F44576]/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
                      <div className="space-y-3">
                        <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-xl flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-3xl font-bold text-[#F44576]">
                          {tournament.matches.filter(m => m.status === 'finished').length}
                        </div>
                        <p className="text-gray-300 font-medium">Terminés</p>
                        <div className="text-xs text-gray-400 bg-[#091626]/50 rounded-lg px-3 py-1 border border-[#182859]/30">
                          {tournament.matches.filter(m => m.status === 'running').length} en cours
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Matchs à venir */}
                  <div className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F44576]/20 to-[#F44576]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                    <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 text-center hover:border-[#F44576]/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
                      <div className="space-y-3">
                        <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-xl flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                          <Clock className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-3xl font-bold text-[#F44576]">
                          {tournament.matches.filter(m => m.status === 'not_started').length}
                        </div>
                        <p className="text-gray-300 font-medium">À venir</p>
                        <div className="text-xs text-gray-400 bg-[#091626]/50 rounded-lg px-3 py-1 border border-[#182859]/30">
                          {tournament.matches.filter(m => m.rescheduled).length} reportés
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistiques avancées */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Informations du tournoi */}
                <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                        <Info className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Informations</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Format</span>
                        <span className="text-white font-medium">{tournament.type}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Région</span>
                        <span className="text-white font-medium">{tournament.region}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Tier</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getTierColor(tournament.tier)}`}>
                          {tournament.tier.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Jeu</span>
                        <span className="text-white font-medium">{tournament.videogame.name}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progression du tournoi */}
                <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                          <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Progression</h3>
                      </div>
                      <div className="space-y-3">
                        {(() => {
                          const totalMatches = tournament.matches.length;
                          const finishedMatches = tournament.matches.filter(m => m.status === 'finished').length;
                          const progressPercentage = totalMatches > 0 ? (finishedMatches / totalMatches) * 100 : 0;

                          return (
                            <>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Avancement</span>
                                  <span className="text-white font-medium">{Math.round(progressPercentage)}%</span>
                                </div>
                                <div className="w-full bg-[#091626] rounded-full h-2 border border-[#182859]/30">
                                  <div
                                    className="bg-gradient-to-r from-[#F44576] to-[#F44576] h-2 rounded-full transition-all duration-1000 shadow-lg shadow-[#F44576]/20"
                                    style={{ width: `${progressPercentage}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="text-center">
                                  <div className="text-[#F44576] font-bold">{finishedMatches}</div>
                                  <div className="text-gray-400">Terminés</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-[#F44576] font-bold">{totalMatches - finishedMatches}</div>
                                  <div className="text-gray-400">Restants</div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                </div>

                {/* Équipe gagnante */}
                <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                          <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Gagnant</h3>
                      </div>
                      <div className="space-y-3">
                        {(() => {
                          const winner = tournament.winner_id ? tournament.teams.find(t => t.id === tournament.winner_id) : null;

                          if (winner) {
                            return (
                              <div className="text-center space-y-2">
                                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#F44576]/20 to-[#F44576]/10 rounded-xl flex items-center justify-center border border-[#F44576]/20">
                                  {winner.image_url ? (
                                    <img
                                      src={winner.image_url}
                                      alt={winner.name}
                                      className="w-12 h-12 object-contain"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Trophy className="w-8 h-8 text-[#F44576]" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-white font-bold">{winner.name}</div>
                                  <div className="text-gray-400 text-sm">{winner.acronym}</div>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="text-center space-y-2">
                                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-500/20 to-gray-600/10 rounded-xl flex items-center justify-center border border-gray-500/20">
                                  <Clock className="w-8 h-8 text-gray-400" />
                                </div>
                                <div>
                                  <div className="text-gray-400 font-medium">À déterminer</div>
                                  <div className="text-gray-500 text-sm">Tournoi en cours</div>
                                </div>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                </div>
              </div>
            </section>

            {/* Tous les matchs avec filtres */}
            <section className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
                    <Gamepad2 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white">Tous les Matchs</h2>
                </div>
                <p className="text-gray-400 text-sm ml-13">
                  {tournament.matches.length} match{tournament.matches.length > 1 ? 's' : ''} au total
                </p>
              </div>

              {tournament.matches.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {tournament.matches.map(match => (
                    <PandaMatchCard key={match.id} match={match} tournamentName={tournament.name} />
                  ))}
                </div>
              ) : (
                <Card variant="outlined" className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-500/20 to-gray-600/10 rounded-xl flex items-center justify-center">
                      <Gamepad2 className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400 text-lg">Aucun match disponible</p>
                    <p className="text-gray-500 text-sm">Les matchs apparaîtront ici une fois programmés</p>
                  </div>
                </Card>
              )}
            </section>

            {/* Équipes et Rosters */}
            <section>
              <TeamsRosters tournament={tournament} />
            </section>

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
