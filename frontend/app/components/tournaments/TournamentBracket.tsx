'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { GitBranch } from 'lucide-react';
// @ts-expect-error — no type declarations for this package
import { SingleEliminationBracket, createTheme } from '@g-loot/react-tournament-brackets';
import { PandaMatch } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';

// ─── Inline types (from @g-loot/react-tournament-brackets) ───────────

type ParticipantType = {
  id: string | number;
  isWinner?: boolean;
  name?: string;
  status?: string | null;
  resultText?: string | null;
  [key: string]: any;
};

type MatchType = {
  id: number | string;
  href?: string;
  name?: string;
  nextMatchId: number | string | null;
  tournamentRoundText?: string;
  startTime: string;
  state: string;
  participants: ParticipantType[];
  [key: string]: any;
};

type MatchComponentProps = {
  match: MatchType;
  onMatchClick: (args: {
    match: MatchType;
    topWon: boolean;
    bottomWon: boolean;
    event: React.MouseEvent;
  }) => void;
  onPartyClick: (party: ParticipantType, partyWon: boolean) => void;
  onMouseEnter: (partyId: string | number) => void;
  onMouseLeave: () => void;
  topParty: ParticipantType;
  bottomParty: ParticipantType;
  topWon: boolean;
  bottomWon: boolean;
  topHovered: boolean;
  bottomHovered: boolean;
  topText: string;
  bottomText: string;
  connectorColor?: string;
  teamNameFallback: string;
  resultFallback: (participant: ParticipantType) => string;
};

interface TournamentBracketProps {
  matches: PandaMatch[];
}

// ─── Section ordering (same as before) ───────────────────────────────

const SECTION_ORDER: Record<string, number> = {
  'round 1': 0,
  'round of 64': 1,
  'round of 32': 2,
  'round of 16': 3,
  'round of 12': 3,
  'round of 8': 4,
  'quarterfinals': 5,
  'quarter-finals': 5,
  'semifinals': 6,
  'semi-finals': 6,
  'lower bracket round 1': 1,
  'lower bracket round 2': 2,
  'lower bracket round 3': 3,
  'lower bracket round 4': 4,
  'lower bracket round 5': 5,
  'lower bracket quarterfinals': 5,
  'lower bracket semi-finals': 6,
  'lower bracket semifinals': 6,
  'lower bracket final': 7,
  'upper bracket round 1': 1,
  'upper bracket round 2': 2,
  'upper bracket quarterfinals': 5,
  'upper bracket semi-finals': 6,
  'upper bracket semifinals': 6,
  'upper bracket final': 7,
  'grand final': 8,
  'grand finals': 8,
  'finals': 8,
  'final': 8,
  'third place match': 7,
  '3rd place match': 7,
};

function getSectionOrder(section: string): number {
  const lower = section.toLowerCase().trim();
  if (SECTION_ORDER[lower] !== undefined) return SECTION_ORDER[lower];
  const roundMatch = lower.match(/round\s*(\d+)/);
  if (roundMatch) return parseInt(roundMatch[1], 10);
  return 50;
}

function groupAndSortSections(
  matches: PandaMatch[]
): { section: string; matches: PandaMatch[] }[] {
  const groups = new Map<string, PandaMatch[]>();
  const order: string[] = [];

  for (const m of matches) {
    const section = m.section || '';
    if (!section) continue;
    if (!groups.has(section)) {
      groups.set(section, []);
      order.push(section);
    }
    groups.get(section)!.push(m);
  }

  order.sort((a, b) => getSectionOrder(a) - getSectionOrder(b));
  return order.map((s) => ({ section: s, matches: groups.get(s)! }));
}

// ─── Transform PandaMatch[] → MatchType[] ────────────────────────────

function transformToBracketData(pandaMatches: PandaMatch[]): MatchType[] {
  const sections = groupAndSortSections(pandaMatches);
  if (sections.length === 0) return [];

  const result: MatchType[] = [];

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const cur = sections[sIdx];
    const next = sections[sIdx + 1];

    for (let mIdx = 0; mIdx < cur.matches.length; mIdx++) {
      const match = cur.matches[mIdx];

      // Compute nextMatchId by pairing consecutive matches → next round
      let nextMatchId: number | string | null = null;
      if (next && cur.matches.length === 2 * next.matches.length) {
        const nextIdx = Math.floor(mIdx / 2);
        if (nextIdx < next.matches.length) {
          nextMatchId = next.matches[nextIdx].id;
        }
      }

      // Build participants
      const home = match.opponents?.[0]?.opponent;
      const away = match.opponents?.[1]?.opponent;
      const homeScore = match.results?.find(
        (r) => r.team_id === home?.id
      )?.score;
      const awayScore = match.results?.find(
        (r) => r.team_id === away?.id
      )?.score;
      const isFinished = match.status === 'finished';
      const isLive = match.status === 'running';

      const participants: ParticipantType[] = [];

      if (home) {
        participants.push({
          id: home.id || `home-${match.id}`,
          name: home.name || 'TBD',
          isWinner: isFinished && match.winner_id === home.id,
          resultText:
            homeScore !== undefined ? String(homeScore) : null,
          status: isLive || isFinished ? 'PLAYED' : null,
          // Extra fields for our custom component
          image_url: home.image_url,
        });
      } else {
        participants.push({
          id: `tbd-home-${match.id}`,
          name: 'TBD',
          isWinner: false,
          resultText: null,
          status: null,
        });
      }

      if (away) {
        participants.push({
          id: away.id || `away-${match.id}`,
          name: away.name || 'TBD',
          isWinner: isFinished && match.winner_id === away.id,
          resultText:
            awayScore !== undefined ? String(awayScore) : null,
          status: isLive || isFinished ? 'PLAYED' : null,
          image_url: away.image_url,
        });
      } else {
        participants.push({
          id: `tbd-away-${match.id}`,
          name: 'TBD',
          isWinner: false,
          resultText: null,
          status: null,
        });
      }

      let state: string;
      if (isLive) state = 'RUNNING';
      else if (isFinished) state = 'SCORE_DONE';
      else state = 'SCHEDULED';

      result.push({
        id: match.id,
        name: match.name || '',
        nextMatchId,
        tournamentRoundText: String(sIdx + 1),
        startTime: match.begin_at || match.scheduled_at || '',
        state,
        participants,
        // Store original match id for link
        href: `/match/${match.id}`,
      });
    }
  }

  return result;
}

// ─── Custom dark theme ───────────────────────────────────────────────

const esportTheme = createTheme({
  fontFamily: 'inherit',
  transitionTimingFunction: 'ease-out',
  disabledColor: 'rgba(255,255,255,0.15)',
  roundHeaders: {
    background: '#0d1b2a',
  },
  matchBackground: {
    wonColor: 'rgba(242, 46, 98, 0.06)',
    lostColor: '#091626',
  },
  border: {
    color: 'rgba(255,255,255,0.08)',
    highlightedColor: '#F22E62',
  },
  textColor: {
    highlighted: '#F22E62',
    main: '#e2e8f0',
    dark: '#94a3b8',
    disabled: '#475569',
  },
  score: {
    text: {
      highlightedWonColor: '#F22E62',
      highlightedLostColor: '#64748b',
    },
    background: {
      wonColor: 'rgba(242, 46, 98, 0.12)',
      lostColor: 'rgba(255,255,255,0.03)',
    },
  },
  canvasBackground: 'transparent',
});

// ─── Custom Match Component ──────────────────────────────────────────

function CustomMatch({
  match,
  onMatchClick,
  onMouseEnter,
  onMouseLeave,
  topParty,
  bottomParty,
  topWon,
  bottomWon,
  topHovered,
  bottomHovered,
  topText,
  bottomText,
}: MatchComponentProps) {
  const isLive = match.state === 'RUNNING';

  const renderParty = (
    party: ParticipantType,
    won: boolean,
    hovered: boolean,
    text: string,
    isTop: boolean
  ) => {
    const imageUrl = (party as any).image_url;
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 transition-colors ${
          isTop ? 'border-b border-white/5' : ''
        } ${won ? 'bg-[#F22E62]/8' : ''} ${hovered ? 'bg-white/5' : ''}`}
        onMouseEnter={() => onMouseEnter(party.id)}
        onMouseLeave={onMouseLeave}
      >
        <div className="w-4 h-4 rounded overflow-hidden flex items-center justify-center flex-shrink-0 bg-white/5">
          {imageUrl ? (
            <img
              src={proxyImageUrl(imageUrl)}
              alt=""
              className="w-3.5 h-3.5 object-contain"
              loading="lazy"
            />
          ) : (
            <span className="text-[7px] font-bold text-slate-500">
              {party.name?.slice(0, 2).toUpperCase() || '?'}
            </span>
          )}
        </div>
        <span
          className={`text-[11px] truncate flex-1 ${
            won
              ? 'font-bold text-white'
              : 'font-medium text-slate-300'
          }`}
        >
          {party.name || 'TBD'}
        </span>
        <span
          className={`text-[11px] tabular-nums w-4 text-right font-medium ${
            isLive
              ? 'text-red-400 font-bold'
              : won
                ? 'font-bold text-white'
                : 'text-slate-500'
          }`}
        >
          {text || '-'}
        </span>
      </div>
    );
  };

  return (
    <div
      className="cursor-pointer"
      onClick={(e) =>
        onMatchClick?.({
          match,
          topWon,
          bottomWon,
          event: e as any,
        })
      }
    >
      <div className="w-48 rounded-md overflow-hidden bg-[#091626] border border-white/8 hover:border-[#F22E62]/40 transition-all">
        {isLive && (
          <div className="h-0.5 bg-red-500 w-full" />
        )}
        {renderParty(topParty, topWon, topHovered, topText, true)}
        {renderParty(
          bottomParty,
          bottomWon,
          bottomHovered,
          bottomText,
          false
        )}
      </div>
    </div>
  );
}

// ─── Fallback display (no section data) ──────────────────────────────

function FallbackBracketCell({ match }: { match: PandaMatch }) {
  const home = match.opponents?.[0]?.opponent;
  const away = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(
    (r) => r.team_id === home?.id
  )?.score;
  const awayScore = match.results?.find(
    (r) => r.team_id === away?.id
  )?.score;
  const isFinished = match.status === 'finished';
  const homeWon = isFinished && match.winner_id === home?.id;
  const awayWon = isFinished && match.winner_id === away?.id;

  return (
    <Link href={`/match/${match.id}`}>
      <div className="w-52 rounded-md border border-[var(--color-border-primary)]/60 bg-[var(--color-bg-secondary)] overflow-hidden hover:border-[#F22E62]/50 transition-all cursor-pointer">
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--color-border-primary)]/30 ${
            homeWon ? 'bg-[#F22E62]/8' : ''
          }`}
        >
          <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center flex-shrink-0 bg-[var(--color-bg-primary)]/40">
            {home?.image_url ? (
              <img
                src={proxyImageUrl(home.image_url)}
                alt=""
                className="w-4 h-4 object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-[8px] font-bold text-[var(--color-text-muted)]">
                {home?.name?.slice(0, 2).toUpperCase() || '?'}
              </span>
            )}
          </div>
          <span
            className={`text-xs truncate flex-1 ${
              homeWon
                ? 'font-bold text-[var(--color-text-primary)]'
                : 'font-medium text-[var(--color-text-secondary)]'
            }`}
          >
            {home?.name || 'TBD'}
          </span>
          <span className="text-xs tabular-nums w-4 text-right text-[var(--color-text-muted)]">
            {homeScore !== undefined ? homeScore : '-'}
          </span>
        </div>
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 ${
            awayWon ? 'bg-[#F22E62]/8' : ''
          }`}
        >
          <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center flex-shrink-0 bg-[var(--color-bg-primary)]/40">
            {away?.image_url ? (
              <img
                src={proxyImageUrl(away.image_url)}
                alt=""
                className="w-4 h-4 object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-[8px] font-bold text-[var(--color-text-muted)]">
                {away?.name?.slice(0, 2).toUpperCase() || '?'}
              </span>
            )}
          </div>
          <span
            className={`text-xs truncate flex-1 ${
              awayWon
                ? 'font-bold text-[var(--color-text-primary)]'
                : 'font-medium text-[var(--color-text-secondary)]'
            }`}
          >
            {away?.name || 'TBD'}
          </span>
          <span className="text-xs tabular-nums w-4 text-right text-[var(--color-text-muted)]">
            {awayScore !== undefined ? awayScore : '-'}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function TournamentBracket({
  matches,
}: TournamentBracketProps) {
  const bracketData = useMemo(
    () => transformToBracketData(matches),
    [matches]
  );

  const sections = useMemo(
    () => groupAndSortSections(matches),
    [matches]
  );

  // Can't render library bracket if no section data or no valid tree
  const hasValidTree = bracketData.length > 0 && bracketData.some((m) => m.nextMatchId !== null);

  if (sections.length === 0) return null;

  // Fallback: simple grid layout if no tree structure
  if (!hasValidTree) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <GitBranch className="w-5 h-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            Bracket
          </h2>
        </div>
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-6 items-start min-w-max">
            {sections.map((group) => (
              <div
                key={group.section}
                className="flex flex-col items-center gap-3"
              >
                <div className="px-3 py-1 rounded bg-[var(--color-bg-hover)] border border-[var(--color-border-primary)]/30">
                  <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                    {group.section}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {group.matches.map((match) => (
                    <FallbackBracketCell
                      key={match.id}
                      match={match}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <GitBranch className="w-5 h-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          Bracket
        </h2>
      </div>

      <div className="overflow-x-auto pb-4 -mx-4 px-4 bracket-container">
        <SingleEliminationBracket
          matches={bracketData}
          matchComponent={CustomMatch}
          theme={esportTheme}
          options={{
            style: {
              connectorColor: '#F22E62',
              connectorColorHighlight: '#FF4775',
              roundHeader: {
                isShown: true,
                backgroundColor: '#0d1b2a',
                fontColor: '#94a3b8',
                fontSize: 11,
                fontFamily: 'inherit',
              },
              width: 200,
              boxHeight: 64,
              spaceBetweenColumns: 48,
              spaceBetweenRows: 12,
            },
          }}
        />
      </div>
    </section>
  );
}
