'use client';

import React from 'react';
import Link from 'next/link';
import { Play, Calendar, Trophy, Zap } from 'lucide-react';
import { LiveMatch } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';

interface LiveMatchCardProps {
  match: LiveMatch;
  showGames?: boolean; // true by default, false to hide games list
}

export default function LiveMatchCard({ match, showGames = true }: LiveMatchCardProps) {
  // Get teams from opponents array
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;

  // Get scores from results array
  const homeScore = match.results?.find(r => r.team_id === homeTeam?.id)?.score ?? '-';
  const awayScore = match.results?.find(r => r.team_id === awayTeam?.id)?.score ?? '-';

  // Determine status
  const isLive = match.status === 'running';
  const isFinished = match.status === 'finished';
  const isUpcoming = match.status === 'not_started';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check for stream availability
  const mainStream = match.streams_list?.[0];
  const hasStream = mainStream?.raw_url && isLive;

  return (
    <Link href={`/match/${match.id}${match.wiki ? `?wiki=${match.wiki}` : ''}`}>
      <div className="group relative h-full cursor-pointer">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#F44576]/15 via-transparent to-[#182859]/10 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

        {/* Main card */}
        <div className="relative h-full bg-bg-primary border border-border-primary rounded-2xl overflow-hidden backdrop-blur-sm hover:border-[#F44576]/30 transition-all duration-300 flex flex-col">

        {/* Header with status and tournament */}
        <div className="relative p-4 border-b border-[#182859]/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">{match.tournament?.name || 'Tournament'}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{match.name}</p>
            </div>

            {/* Status badge */}
            <div className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold uppercase whitespace-nowrap ${
              isLive ? 'bg-red-500/30 text-red-300 border border-red-500/50' :
              isFinished ? 'bg-gray-400/20 text-gray-500 border border-gray-400/30' :
              'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {isLive && <><Zap className="w-3 h-3 inline mr-1" />LIVE</> }
              {isFinished && 'Terminé'}
              {isUpcoming && 'À venir'}
            </div>
          </div>
        </div>

        {/* Match content */}
        <div className="flex-1 flex flex-col justify-center p-4 space-y-4">
          {/* Teams and Score */}
          <div className="flex items-center justify-between gap-2">
            {/* Home Team */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#182859]/50 to-[#060B13]/50 border border-[#182859]/30 flex items-center justify-center overflow-hidden group/logo hover:border-[#F44576]/40 transition-colors">
                {homeTeam?.image_url ? (
                  <img
                    src={proxyImageUrl(homeTeam.image_url)}
                    alt={homeTeam.name}
                    className="w-10 h-10 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Trophy className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="text-xs font-bold text-text-primary truncate leading-tight">
                  {homeTeam?.acronym || homeTeam?.name?.slice(0, 3).toUpperCase() || 'TBD'}
                </p>
                <p className="text-xs text-gray-400 truncate">{homeTeam?.name?.slice(0, 12) || '-'}</p>
              </div>
            </div>

            {/* Score Display */}
            <div className="flex flex-col items-center gap-2 px-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#F44576] font-mono">
                  {isFinished || isLive ? (
                    <>
                      <span>{homeScore}</span>
                      <span className="text-gray-400 mx-1">-</span>
                      <span>{awayScore}</span>
                    </>
                  ) : (
                    'VS'
                  )}
                </div>
              </div>
              {match.number_of_games && (
                <div className="text-xs text-gray-400 font-medium bg-[#182859]/20 px-2 py-1 rounded-md">
                  BO{match.number_of_games}
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#182859]/50 to-[#060B13]/50 border border-[#182859]/30 flex items-center justify-center overflow-hidden group/logo hover:border-[#F44576]/40 transition-colors">
                {awayTeam?.image_url ? (
                  <img
                    src={proxyImageUrl(awayTeam.image_url)}
                    alt={awayTeam.name}
                    className="w-10 h-10 object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Trophy className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="text-xs font-bold text-primary truncate leading-tight">
                  {awayTeam?.acronym || awayTeam?.name?.slice(0, 3).toUpperCase() || 'TBD'}
                </p>
                <p className="text-xs text-gray-400 truncate">{awayTeam?.name?.slice(0, 12) || '-'}</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#182859]/30 to-transparent"></div>

          {/* Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5 text-[#F44576]" />
              <span className="font-medium">{(match.begin_at || match.scheduled_at) ? formatDate(match.begin_at || match.scheduled_at!) : '-'}</span>
              <span className="text-gray-600">•</span>
              <span>{(match.begin_at || match.scheduled_at) ? formatTime(match.begin_at || match.scheduled_at!) : '-'}</span>
            </div>
          </div>
        </div>

        {/* Actions footer */}
        <div className="border-t border-[#182859]/20 p-3 space-y-2">
          {hasStream && (
            <button
              onClick={(e) => {
                e.preventDefault();
                window.open(mainStream.raw_url, '_blank', 'noopener,noreferrer');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-[#F44576] to-[#F44576] hover:from-[#F44576]/90 hover:to-[#F44576]/80 text-white rounded-lg font-semibold transition-all duration-200 text-sm shadow-lg shadow-[#F44576]/20 hover:shadow-[#F44576]/40"
            >
              <Play className="w-4 h-4 fill-current" />
              Regarder
            </button>
          )}

          {/* Games list */}
          {showGames && match.games && match.games.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#182859]/20">
              {match.games.slice(0, 3).map((game, idx) => (
                <div key={game.id} className="flex items-center justify-between text-xs px-2 py-1 bg-[#182859]/10 rounded">
                  <span className="text-gray-500">Game {idx + 1}</span>
                  <span className={`font-medium ${
                    game.status === 'finished' ? 'text-green-400' :
                    game.status === 'running' ? 'text-[#F44576]' :
                    'text-gray-400'
                  }`}>
                    {game.status === 'finished' ? '✓' : game.status === 'running' ? '●' : '○'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Game info */}
          <div className="flex items-center justify-between text-xs px-2 py-1">
            <span className="text-gray-500">{match.videogame?.name || 'Esport'}</span>
            {match.league && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 truncate max-w-[100px]">{match.league.name}</span>
                {match.league.image_url && (
                  <div className="w-4 h-4 rounded-sm flex-shrink-0 overflow-hidden border border-[#182859]/30">
                    <img
                      src={proxyImageUrl(match.league.image_url)}
                      alt={match.league.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </Link>
  );
}
