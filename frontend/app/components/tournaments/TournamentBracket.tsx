'use client';

import React, { useMemo } from 'react';
import { matchHref } from '../../lib/gameLinks';
import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PandaMatch } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';
import { useIsDarkTheme, pickThemeLogo } from '../../hooks/useIsDarkTheme';
import {
  buildBracketLayout,
  buildGroupColumns,
  columnX,
  CELL_H,
  CELL_W,
  CONNECTOR_W,
  type BracketEdge,
  type ColumnLabel,
} from './bracketModel';

interface TournamentBracketProps {
  matches: PandaMatch[];
}

const CORNER_R = 5;
const LINE_COLOR = '#F22E62';

// ─── Match cell ──────────────────────────────────────────────────────

function BracketMatchCell({ match, side }: { match: PandaMatch; side: string | null }) {
  const isDark = useIsDarkTheme();
  const home = match.opponents?.[0]?.opponent;
  const away = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === home?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === away?.id)?.score;
  const isLive = match.status === 'running';
  const isFinished = match.status === 'finished';
  const homeWon = isFinished && match.winner_id === home?.id;
  const awayWon = isFinished && match.winner_id === away?.id;

  return (
    <Link href={matchHref(match)}>
      <div
        className="group relative rounded-md border border-[var(--color-border-primary)]/60 bg-[var(--color-bg-secondary)] overflow-hidden hover:border-[#F22E62]/50 transition-all duration-200 cursor-pointer hover:shadow-[0_0_12px_rgba(242,46,98,0.15)]"
        style={{ width: CELL_W, height: CELL_H }}
      >
        {isLive && <div className="h-0.5 bg-[var(--color-status-live)] w-full" />}
        {side && (
          <span className="absolute top-0.5 right-0.5 z-10 px-1 rounded-sm bg-[var(--color-bg-primary)]/80 text-[7px] font-bold tracking-wider text-[var(--color-text-muted)]">
            {side === 'lower' ? 'LB' : 'UB'}
          </span>
        )}
        {/* Team 1 */}
        <div className={`flex items-center gap-2 px-2.5 py-1 border-b border-[var(--color-border-primary)]/30 ${homeWon ? 'bg-[#F22E62]/8' : ''}`}>
          <div className="w-4 h-4 rounded overflow-hidden flex items-center justify-center flex-shrink-0 bg-[var(--color-bg-primary)]/40">
            {pickThemeLogo(isDark, home?.image_url, home?.dark_image_url) ? (
              <img src={proxyImageUrl(pickThemeLogo(isDark, home?.image_url, home?.dark_image_url)!)} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" />
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
            {pickThemeLogo(isDark, away?.image_url, away?.dark_image_url) ? (
              <img src={proxyImageUrl(pickThemeLogo(isDark, away?.image_url, away?.dark_image_url)!)} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" />
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

// ─── Connectors ──────────────────────────────────────────────────────
//
// One path per real parent→child link. Two parents converging on the same child
// produce the familiar bracket elbow; a single parent (lower-bracket drop-in)
// produces one line. The elbow always turns in the gap right before the child,
// so a link spanning several columns runs straight through at the parent's height.

function edgePath({ fromX, fromY, toX, toY }: BracketEdge): string {
  const vertX = toX - CONNECTOR_W / 2;
  const delta = toY - fromY;
  if (Math.abs(delta) < 1) return `M ${fromX},${fromY} H ${toX}`;

  const dir = delta > 0 ? 1 : -1;
  const cr = Math.min(CORNER_R, Math.abs(delta) / 2);
  return [
    `M ${fromX},${fromY}`,
    `H ${vertX - cr}`,
    `Q ${vertX},${fromY} ${vertX},${fromY + dir * cr}`,
    `V ${toY - dir * cr}`,
    `Q ${vertX},${toY} ${vertX + cr},${toY}`,
    `H ${toX}`,
  ].join(' ');
}

function EdgeOverlay({ edges, width, height }: { edges: BracketEdge[]; width: number; height: number }) {
  const paths = useMemo(() => edges.map(edgePath), [edges]);
  if (paths.length === 0) return null;

  return (
    <svg width={width} height={height} className="absolute inset-0 pointer-events-none" aria-hidden>
      {paths.map((d, i) => (
        <path key={`glow-${i}`} d={d} stroke={LINE_COLOR} strokeWidth={6} strokeOpacity={0.25} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {paths.map((d, i) => (
        <path key={`line-${i}`} d={d} stroke={LINE_COLOR} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

// ─── Main component ──────────────────────────────────────────────────

function RoundPill({ text }: { text: string }) {
  return (
    <div className="px-3 py-1 rounded bg-[var(--color-bg-hover)] border border-[var(--color-border-primary)]/30">
      <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
        {text}
      </span>
    </div>
  );
}

function BlockHeading({ text }: { text: string }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
      {text}
    </h3>
  );
}

export default function TournamentBracket({ matches }: TournamentBracketProps) {
  const t = useTranslations('pages_detail.tournament_detail');
  const groups = useMemo(() => buildGroupColumns(matches), [matches]);
  const layout = useMemo(() => buildBracketLayout(matches), [matches]);

  if (groups.length === 0 && layout.columns.length === 0) return null;

  const label = (l: ColumnLabel) => t(l.key, l.round !== undefined ? { round: l.round } : undefined);
  // Sub-headings only earn their place when both blocks are on screen.
  const bothBlocks = groups.length > 0 && layout.columns.length > 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <GitBranch className="w-5 h-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('bracket_title')}</h2>
      </div>

      {/* ── Group / Swiss rounds: plain columns, stacked above the tree ── */}
      {groups.length > 0 && (
        <div className="space-y-3">
          {bothBlocks && <BlockHeading text={t('bracket_group_stage')} />}
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex items-start gap-4 min-w-max">
              {groups.map(col => (
                <div key={col.key} className="flex flex-col items-center gap-2" style={{ width: CELL_W }}>
                  <RoundPill text={col.label} />
                  {col.matches.map(match => (
                    <BracketMatchCell key={match.match2id || match.id} match={match} side={null} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Elimination tree ── */}
      {layout.columns.length > 0 && (
        <div className="space-y-3">
          {bothBlocks && <BlockHeading text={t('bracket_playoffs')} />}
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="min-w-max">
              <div className="flex">
                {layout.columns.map((col, colIdx) => (
                  <React.Fragment key={`label-${col.key}`}>
                    {colIdx > 0 && <div style={{ width: CONNECTOR_W }} />}
                    <div className="flex justify-center mb-3" style={{ width: CELL_W }}>
                      <RoundPill text={label(col.label)} />
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div className="relative" style={{ width: layout.width, height: layout.height }}>
                <EdgeOverlay edges={layout.edges} width={layout.width} height={layout.height} />

                {layout.columns.map((col, colIdx) => (
                  <div
                    key={`col-${col.key}`}
                    className="absolute top-0"
                    style={{ left: columnX(colIdx), width: CELL_W, height: layout.height }}
                  >
                    {col.startsStage && (
                      <div
                        className="absolute top-0 h-full border-l border-dashed border-[var(--color-border-primary)]/60"
                        style={{ left: -CONNECTOR_W / 2 }}
                      />
                    )}
                    {col.cells.map(cell => (
                      <div
                        key={cell.match.match2id || cell.match.id}
                        className="absolute left-0"
                        style={{ top: cell.centerY - CELL_H / 2, width: CELL_W, height: CELL_H }}
                      >
                        <BracketMatchCell match={cell.match} side={cell.side} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
