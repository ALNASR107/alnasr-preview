import type { Kpis } from '@/lib/types';
import { compact, num } from '@/lib/format';
import { Ic } from './Icons';

function Spark({ vals, color }: { vals: number[]; color: string }) {
  if (!vals.length) return null;
  const w = 74;
  const h = 26;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const pts = vals.map((v, i) => {
    const x = (i / Math.max(1, vals.length - 1)) * (w - 2) + 1;
    const y = h - 3 - ((v - min) / (max - min || 1)) * (h - 8);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return (
    <span className="spark">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path d={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
      </svg>
    </span>
  );
}

type Card = {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  accent: string;
  bg: string;
  trend: string;
  trendUp: boolean;
  note: string;
  spark?: number[];
};

export default function KpiRow({ kpis, sparkIn, sparkOut }: { kpis: Kpis; sparkIn?: number[]; sparkOut?: number[] }) {
  const cards: Card[] = [
    {
      label: 'إجمالي الوارد', value: compact(kpis.sumIn), unit: 'ل.س', icon: 'i-in',
      accent: 'var(--in)', bg: 'var(--in-bg)', trend: '+12.4%', trendUp: true,
      note: 'مقارنة بالفترة السابقة', spark: sparkIn,
    },
    {
      label: 'إجمالي الصادر', value: compact(kpis.sumOut), unit: 'ل.س', icon: 'i-out',
      accent: 'var(--out)', bg: 'var(--out-bg)', trend: '-4.1%', trendUp: false,
      note: 'مقارنة بالفترة السابقة', spark: sparkOut,
    },
    {
      label: 'صافي الحركة', value: (kpis.net >= 0 ? '+' : '−') + compact(Math.abs(kpis.net)), unit: 'ل.س',
      icon: 'i-swap', accent: 'var(--primary-600)', bg: 'var(--primary-50)',
      trend: '+8.2%', trendUp: kpis.net >= 0, note: 'وارد − صادر',
    },
    {
      label: 'بحاجة إلى إجراء', value: num(kpis.needsAction), unit: 'عملية', icon: 'i-clock',
      accent: 'var(--wait)', bg: 'var(--wait-bg)', trend: `${kpis.pending} معلّقة`,
      trendUp: false, note: 'مراجعة + معلّقة',
    },
    {
      label: 'نسبة الترحيل', value: `${kpis.postRate}%`, icon: 'i-check',
      accent: 'var(--rev)', bg: 'var(--rev-bg)', trend: `${kpis.postedCount} مرحّلة`,
      trendUp: true, note: 'من إجمالي العمليات',
    },
  ];

  return (
    <div className="grid kpis">
      {cards.map((c) => (
        <div key={c.label} className="card kpi" style={{ ['--accent' as string]: c.accent, ['--accent-bg' as string]: c.bg }}>
          <div className="kpi-top">
            <div className="kpi-ic"><Ic n={c.icon} sm /></div>
            <div className="kpi-label">{c.label}</div>
          </div>
          <div className="kpi-val">
            {c.value}
            {c.unit ? <span>{c.unit}</span> : null}
          </div>
          <div className="kpi-foot">
            <span className={`trend ${c.trendUp ? 'up' : 'down'}`}>
              <Ic n={c.trendUp ? 'i-in' : 'i-out'} xs />
              {c.trend}
            </span>
            <span>{c.note}</span>
            {c.spark ? <Spark vals={c.spark} color={c.accent} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
