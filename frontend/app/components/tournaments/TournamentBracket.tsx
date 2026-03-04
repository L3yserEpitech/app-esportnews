'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import { PandaMatch } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';

interface TournamentBracketProps {
  matches: PandaMatch[];
}

// ─── Layout constants ────────────────────────────────────────────────
const CELL_H = 58;         // match cell height (px)
const GAP = 16;            // min vertical gap between cells in first round
const SLOT = CELL_H + GAP; // first-round slot height
const CELL_W = 208;        // match cell width (w-52 = 13rem = 208px)
const CONNECTOR_W = 56;    // SVG connector width between columns
const CORNER_R = 5;        // rounded corner radius for bracket lines
const LINE_COLOR = '#F22E62';

// ─── Section ordering ────────────────────────────────────────────────

const SECTION_ORDER: Record<string, number> = {
  'round 1': 0, 'round of 64': 1, 'round of 32': 2, 'round of 16': 3,
  'round of 12': 3, 'round of 8': 4,
  'quarterfinals': 5, 'quarter-finals': 5,
  'semifinals': 6, 'semi-finals': 6,
  'lower bracket round 1': 1, 'lower bracket round 2': 2,
  'lower bracket round 3': 3, 'lower bracket round 4': 4,
  'lower bracket round 5': 5, 'lower bracket quarterfinals': 5,
  'lower bracket semi-finals': 6, 'lower bracket semifinals': 6,
  'lower bracket final': 7,
  'upper bracket round 1': 1, 'upper bracket round 2': 2,
  'upper bracket quarterfinals': 5, 'upper bracket semi-finals': 6,
  'upper bracket semifinals': 6, 'upper bracket final': 7,
  'grand final': 8, 'grand finals': 8, 'finals': 8, 'final': 8,
  'third place match': 7, '3rd place match': 7,
};

function getSectionOrder(section: string): number {
  const lower = section.toLowerCase().trim();
  if (SECTION_ORDER[lower] !== undefined) return SECTION_ORDER[lower];
  const m = lower.match(/round\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 50;
}

function groupAndSortSections(matches: PandaMatch[]) {
  const groups = new Map<string, PandaMatch[]>();
  const order: string[] = [];
  for (const m of matches) {
    const s = m.section || '';
    if (!s) continue;
    if (!groups.has(s)) { groups.set(s, []); order.push(s); }
    groups.get(s)!.push(m);
  }
  order.sort((a, b) => getSectionOrder(a) - getSectionOrder(b));
  return order.map(s => ({ section: s, matches: groups.get(s)! }));
}

// ─── Match cell ──────────────────────────────────────────────────────

function BracketMatchCell({ match }: { match: PandaMatch }) {
  const home = match.opponents?.[0]?.opponent;
  const away = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === home?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === away?.id)?.score;
  const isLive = match.status === 'running';
  const isFinished = match.status === 'finished';
  const homeWon = isFinished && match.winner_id === home?.id;
  const awayWon = isFinished && match.winner_id === away?.id;

  return (
    <Link href={`/match/${match.id}`}>
      <div
        className="group rounded-md border border-[var(--color-border-primary)]/60 bg-[var(--color-bg-secondary)] overflow-hidden hover:border-[#F22E62]/50 transition-all duration-200 cursor-pointer hover:shadow-[0_0_12px_rgba(242,46,98,0.15)]"
        style={{ width: CELL_W, height: CELL_H }}
      >
        {isLive && <div className="h-0.5 bg-[var(--color-status-live)] w-full" />}
        {/* Team 1 */}
        <div className={`flex items-center gap-2 px-2.5 py-1 border-b border-[var(--color-border-primary)]/30 ${homeWon ? 'bg-[#F22E62]/8' : ''}`}>
          <div className="w-4 h-4 rounded overflow-hidden flex items-center justify-center flex-shrink-0 bg-[var(--color-bg-primary)]/40">
            {home?.image_url ? (
              <img src={proxyImageUrl(home.image_url)} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" />
            ) : (
              <span className="text-[7px] font-bold text-[var(--color-text-muted)]">{home?.name?.slice(0, 2).toUpperCase() || '?'}</span>
            )}
          </div>
          <span className={`text-[11px] truncate flex-1 ${homeWon ? 'font-bold text-[var(--color-text-primary)]' : 'font-medium text-[var(--color-text-secondary)]'}`}>
            {home?.name || 'TBD'}
          </span>
          <span className={`text-[11px] tabular-nums w-4 text-right ${isLive ? 'text-[var(--color-status-live)] font-bold' : homeWon ? 'font-bold text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            {homeScore !== undefined ? homeScore : '-'}
          </span>
        </div>
        {/* Team 2 */}
        <div className={`flex items-center gap-2 px-2.5 py-1 ${awayWon ? 'bg-[#F22E62]/8' : ''}`}>
          <div className="w-4 h-4 rounded overflow-hidden flex items-center justify-center flex-shrink-0 bg-[var(--color-bg-primary)]/40">
            {away?.image_url ? (
              <img src={proxyImageUrl(away.image_url)} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" />
            ) : (
              <span className="text-[7px] font-bold text-[var(--color-text-muted)]">{away?.name?.slice(0, 2).toUpperCase() || '?'}</span>
            )}
          </div>
          <span className={`text-[11px] truncate flex-1 ${awayWon ? 'font-bold text-[var(--color-text-primary)]' : 'font-medium text-[var(--color-text-secondary)]'}`}>
            {away?.name || 'TBD'}
          </span>
          <span className={`text-[11px] tabular-nums w-4 text-right ${isLive ? 'text-[var(--color-status-live)] font-bold' : awayWon ? 'font-bold text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            {awayScore !== undefined ? awayScore : '-'}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── SVG connector between two rounds ────────────────────────────────
//
//  For a standard bracket (prevCount = 2 × nextCount):
//  Each pair of matches converges into one match in the next round.
//
//  Match A ────┐
//              │
//              ├──── Match C
//              │
//  Match B ────┘
//
//  The SVG draws:
//  - Horizontal from left edge to vertX at each source match center
//  - Vertical from topY to botY at vertX
//  - Horizontal from vertX to right edge at midY (= next match center)
//  - Rounded corners at junctions

function SVGConnector({
  prevCount,
  nextCount,
  totalHeight,
}: {
  prevCount: number;
  nextCount: number;
  totalHeight: number;
}) {
  const prevSlot = totalHeight / prevCount;
  const isPerfect = prevCount === 2 * nextCount;

  if (!isPerfect) {
    // Non-standard: draw simple horizontal pass-through lines
    return (
      <svg
        width={CONNECTOR_W}
        height={totalHeight}
        className="flex-shrink-0 block"
        style={{ overflow: 'visible' }}
      >
        {Array.from({ length: Math.min(prevCount, nextCount) }).map((_, i) => {
          const y = (i + 0.5) * (totalHeight / Math.min(prevCount, nextCount));
          return (
            <line
              key={i}
              x1={0} y1={y} x2={CONNECTOR_W} y2={y}
              stroke={LINE_COLOR} strokeWidth={2} strokeOpacity={0.25}
            />
          );
        })}
      </svg>
    );
  }

  const vertX = CONNECTOR_W / 2; // vertical line at the center of the connector
  const r = CORNER_R;

  return (
    <svg
      width={CONNECTOR_W}
      height={totalHeight}
      className="flex-shrink-0 block"
      style={{ overflow: 'visible' }}
    >
      {/* Glow layer (drawn first, behind) */}
      {Array.from({ length: nextCount }).map((_, j) => {
        const topY = (2 * j + 0.5) * prevSlot;
        const botY = (2 * j + 1.5) * prevSlot;
        const midY = (topY + botY) / 2;

        return (
          <g key={`glow-${j}`} opacity={0.25}>
            <path
              d={bracketPath(topY, botY, midY, vertX, r)}
              stroke={LINE_COLOR}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* Sharp line layer */}
      {Array.from({ length: nextCount }).map((_, j) => {
        const topY = (2 * j + 0.5) * prevSlot;
        const botY = (2 * j + 1.5) * prevSlot;
        const midY = (topY + botY) / 2;

        return (
          <path
            key={`line-${j}`}
            d={bracketPath(topY, botY, midY, vertX, r)}
            stroke={LINE_COLOR}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

/** Build SVG path for one bracket pair with rounded corners */
function bracketPath(
  topY: number,
  botY: number,
  midY: number,
  vertX: number,
  r: number,
): string {
  // Clamp radius so it doesn't exceed half the vertical distance
  const halfV = (botY - topY) / 2;
  const cr = Math.min(r, halfV);

  return [
    // Top arm: horizontal right → rounded corner → vertical down
    `M 0,${topY}`,
    `H ${vertX - cr}`,
    `Q ${vertX},${topY} ${vertX},${topY + cr}`,
    // Vertical down to midpoint
    `V ${midY}`,
    // Branch right to next match
    `H ${CONNECTOR_W}`,
    // Back to midpoint, continue vertical down
    `M ${vertX},${midY}`,
    `V ${botY - cr}`,
    // Rounded corner → horizontal left (bottom arm)
    `Q ${vertX},${botY} ${vertX - cr},${botY}`,
    `H 0`,
  ].join(' ');
}

// ─── Round label ─────────────────────────────────────────────────────

function RoundLabel({ text, width }: { text: string; width: number }) {
  return (
    <div className="flex justify-center mb-3" style={{ width }}>
      <div className="px-3 py-1 rounded bg-[var(--color-bg-hover)] border border-[var(--color-border-primary)]/30">
        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
          {text}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function TournamentBracket({ matches }: TournamentBracketProps) {
  const sections = useMemo(() => groupAndSortSections(matches), [matches]);

  if (sections.length === 0) return null;

  const firstRoundCount = sections[0].matches.length;
  const totalHeight = firstRoundCount * SLOT;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <GitBranch className="w-5 h-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Bracket</h2>
      </div>

      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="min-w-max">
          {/* ── Labels row ── */}
          <div className="flex">
            {sections.map((group, colIdx) => (
              <React.Fragment key={`label-${group.section}`}>
                <RoundLabel text={group.section} width={CELL_W} />
                {colIdx < sections.length - 1 && (
                  <div style={{ width: CONNECTOR_W }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ── Bracket area ── */}
          <div className="flex items-start" style={{ height: totalHeight }}>
            {sections.map((group, colIdx) => {
              const slotH = totalHeight / group.matches.length;

              return (
                <React.Fragment key={`col-${group.section}`}>
                  {/* Match column */}
                  <div className="flex flex-col flex-shrink-0" style={{ width: CELL_W, height: totalHeight }}>
                    {group.matches.map((match) => (
                      <div
                        key={match.id}
                        className="flex items-center justify-center"
                        style={{ height: slotH }}
                      >
                        <BracketMatchCell match={match} />
                      </div>
                    ))}
                  </div>

                  {/* SVG connector to next round */}
                  {colIdx < sections.length - 1 && (
                    <SVGConnector
                      prevCount={group.matches.length}
                      nextCount={sections[colIdx + 1].matches.length}
                      totalHeight={totalHeight}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
