import { STATUS_KEYS, STATUS_META, TONE } from '@/lib/types';
import { num } from '@/lib/format';

export default function Donut({ counts }: { counts: Record<string, number> }) {
  const items = STATUS_KEYS.map((k) => ({ k, n: counts[k] ?? 0 }));
  const total = items.reduce((s, c) => s + c.n, 0) || 1;
  const R = 58;
  const C = 2 * Math.PI * R;
  const size = 172;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const arcs = items.map((c) => {
    const len = (c.n / total) * C;
    const el = (
      <circle
        key={c.k}
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke={TONE[c.k]}
        strokeWidth="16"
        strokeDasharray={`${Math.max(0, len - 2.5)} ${C - len + 2.5}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    offset += len;
    return el;
  });

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--line-soft)" strokeWidth="16" />
          {arcs}
        </svg>
        <div className="donut-center">
          <b className="num">{num(total)}</b>
          <small>عملية</small>
        </div>
      </div>
      <div className="donut-legend">
        {items.map((c) => (
          <div className="dl-row" key={c.k}>
            <i style={{ background: TONE[c.k] }} />
            {STATUS_META[c.k].label}
            <b className="num">{Math.round((c.n / total) * 100)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
