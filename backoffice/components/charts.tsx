'use client';

import { day } from '@/lib/format';

export interface ChartLine {
  label: string;
  values: number[];
  color: string;
  dashed?: boolean;
  width?: number;
  // A line with its own scale is drawn against its own maximum (clicks vs
  // impressions): only the shape compares, and the legend says so.
  ownScale?: boolean;
}

const nf = new Intl.NumberFormat('fr-FR');

// The axis has three steps above zero. Its top is three times a readable step
// (1, 2, 2.5 or 5 × a power of ten), so every label is a round number:
// 0 · 250 · 500 · 750, never 0 · 1 · 3 · 4.
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 3) return 3;
  const raw = max / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const ratio = raw / pow;
  const step = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
  return 3 * step * pow;
}

function path(values: number[], max: number, x: (i: number) => number, y: (v: number, max: number) => number): string {
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v, max).toFixed(1)}`).join(' ');
}

// The line chart of the mock-ups: four grid lines, dates under the axis, one
// accent line and optional comparison lines.
export function LineChart({
  dates,
  lines,
  height = 196,
  width = 760,
  describe,
}: {
  dates: string[];
  lines: ChartLine[];
  height?: number;
  width?: number;
  describe: string;
}) {
  const left = 44;
  const right = width - 8;
  const top = 10;
  const bottom = height - 26;
  const n = Math.max(dates.length, 2);
  const shared = niceMax(Math.max(0, ...lines.filter((l) => !l.ownScale).flatMap((l) => l.values)));
  const x = (i: number) => left + ((right - left) * i) / (n - 1);
  const y = (v: number, max: number) => bottom - ((bottom - top) * v) / max;
  const ticks = [0, 1, 2, 3].map((i) => (shared * i) / 3);
  const labelEvery = Math.max(1, Math.round(dates.length / 4));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={describe} style={{ display: 'block', width: '100%' }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={y(t, shared)} y2={y(t, shared)} stroke="#F1F1F3" />
          <text x={left - 6} y={y(t, shared) + 4} textAnchor="end" fontSize="10.5" fill="#71717A">
            {nf.format(Math.round(t))}
          </text>
        </g>
      ))}
      {lines.map((l) => {
        if (l.values.length === 0) return null;
        const max = l.ownScale ? niceMax(Math.max(0, ...l.values)) : shared;
        return (
          <path
            key={l.label}
            d={path(l.values, max, x, y)}
            fill="none"
            stroke={l.color}
            strokeWidth={l.width ?? 1.5}
            strokeDasharray={l.dashed ? '4 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
      {dates.map((d, i) =>
        i % labelEvery === 0 || i === dates.length - 1 ? (
          <text
            key={d}
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
            fontSize="10.5"
            fill="#71717A"
          >
            {/* Skip a label that would collide with the last one. */}
            {i === dates.length - 1 || dates.length - 1 - i >= labelEvery / 2 ? day(d + 'T12:00:00') : ''}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function Legend({ lines }: { lines: ChartLine[] }) {
  return (
    <div className="legende">
      {lines.map((l) => (
        <span key={l.label}>
          <i style={{ background: l.color }} />
          {l.label}
          {l.ownScale ? ' (échelle à part)' : ''}
        </span>
      ))}
    </div>
  );
}

// The small trend line of a KPI tile.
export function Sparkline({ values, color = '#F22E62' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((96 * i) / (values.length - 1)).toFixed(1)} ${(26 - (22 * (v - min)) / span).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="spark" viewBox="0 0 96 30" aria-hidden="true" style={{ width: 96, height: 30, flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
