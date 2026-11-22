'use client';

import { useMemo, useState } from 'react';
import { compact } from '@/lib/format';

type Props = { labels: string[]; inSeries: number[]; outSeries: number[]; height?: number };

function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = (p0[0] + p1[0]) / 2;
    d += ` C${cx},${p0[1]} ${cx},${p1[1]} ${p1[0]},${p1[1]}`;
  }
  return d;
}

export default function AreaChart({ labels, inSeries, outSeries, height = 230 }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const g = useMemo(() => {
    const W = 720;
    const H = height;
    const pl = 46;
    const pr = 12;
    const pt = 14;
    const pb = 26;

    const max = Math.max(...inSeries, ...outSeries, 1);
    const step = Math.pow(10, Math.floor(Math.log10(max))) / 2;
    const top = Math.ceil(max / step) * step;

    const x = (i: number) => pl + (i / Math.max(1, inSeries.length - 1)) * (W - pl - pr);
    const y = (v: number) => pt + (1 - v / top) * (H - pt - pb);

    const pin = inSeries.map((v, i) => [x(i), y(v)] as [number, number]);
    const pout = outSeries.map((v, i) => [x(i), y(v)] as [number, number]);
    const area = (pts: [number, number][]) =>
      `${smooth(pts)} L${x(pts.length - 1)},${H - pb} L${x(0)},${H - pb} Z`;

    const grid: { y: number; label: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const val = (top / 4) * i;
      grid.push({ y: y(val), label: (val / 1e6).toFixed(val % 1e6 === 0 ? 0 : 1) });
    }

    return { W, H, pl, pr, pt, pb, x, pin, pout, area, grid };
  }, [inSeries, outSeries, height]);

  const every = Math.ceil(labels.length / 7);
  const tip = hover !== null ? hover : null;

  return (
    <div style={{ position: 'relative', padding: '6px 10px 12px' }}>
      <svg viewBox={`0 0 ${g.W} ${g.H}`} width="100%" height={height} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary-600)" stopOpacity=".26" />
            <stop offset="100%" stopColor="var(--primary-600)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold-400)" stopOpacity=".26" />
            <stop offset="100%" stopColor="var(--gold-400)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {g.grid.map((l, i) => (
          <g key={i}>
            <line x1={g.pl} x2={g.W - g.pr} y1={l.y} y2={l.y} stroke="var(--line-soft)" strokeWidth="1" />
            <text x={g.pl - 9} y={l.y + 4} textAnchor="end" fontSize="10.5" fill="var(--txt-3)">
              {l.label}
            </text>
          </g>
        ))}

        {labels.map((lb, i) =>
          i % every === 0 ? (
            <text key={lb + i} x={g.x(i)} y={g.H - 8} textAnchor="middle" fontSize="10" fill="var(--txt-3)">
              {lb}
            </text>
          ) : null,
        )}

        <path d={g.area(g.pout)} fill="url(#gOut)" />
        <path d={smooth(g.pout)} fill="none" stroke="var(--gold-400)" strokeWidth="2.1" strokeLinecap="round" />
        <path d={g.area(g.pin)} fill="url(#gIn)" />
        <path d={smooth(g.pin)} fill="none" stroke="var(--primary-600)" strokeWidth="2.4" strokeLinecap="round" />

        {tip !== null && (
          <>
            <line
              x1={g.x(tip)}
              x2={g.x(tip)}
              y1={g.pt}
              y2={g.H - g.pb}
              stroke="var(--primary-400)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={g.pin[tip][0]} cy={g.pin[tip][1]} r="3.4" fill="var(--primary-600)" />
            <circle cx={g.pout[tip][0]} cy={g.pout[tip][1]} r="3.4" fill="var(--gold-400)" />
          </>
        )}

        {g.pin.map((p, i) => (
          <rect
            key={i}
            x={p[0] - (g.W - g.pl - g.pr) / (2 * Math.max(1, inSeries.length - 1))}
            y={g.pt}
            width={(g.W - g.pl - g.pr) / Math.max(1, inSeries.length - 1)}
            height={g.H - g.pt - g.pb}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {tip !== null && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: `${Math.max(6, Math.min(92, (g.x(tip) / g.W) * 100))}%`,
            transform: 'translateX(-50%)',
            background: 'var(--ink-900)',
            color: '#fff',
            fontSize: 11,
            padding: '6px 9px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          <b>{labels[tip]}</b> · وارد {compact(inSeries[tip])} · صادر {compact(outSeries[tip])}
        </div>
      )}
    </div>
  );
}
