'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SummaryResponse } from '@/lib/types';
import { STATUS_META } from '@/lib/types';
import { CURRENCY, fmtDateTime, money } from '@/lib/format';
import { fetchSummary } from '@/lib/api';
import { Ic } from './Icons';
import KpiRow from './KpiRow';
import AreaChart from './AreaChart';
import Donut from './Donut';
import Drawer from './Drawer';
import { useToast } from './Toaster';

export default function DashboardView() {
  const toast = useToast();
  const [days, setDays] = useState(14);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchSummary(days, ctrl.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        toast(e.message, 'err');
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [days, toast]);

  const kpis = data?.kpis ?? { sumIn: 0, sumOut: 0, net: 0, needsAction: 0, pending: 0, postedCount: 0, postRate: 0, total: 0 };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>لوحة المتابعة</h1>
          <p>ملخّص حركة العمليات المالية — محدّث من الخادم عبر <code style={{ fontSize: 12 }}>/api/summary</code></p>
        </div>
        <div className="head-actions">
          <div className="seg">
            {[14, 30, 90].map((d) => (
              <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} يوم</button>
            ))}
          </div>
          <Link className="btn btn-primary" href="/operations">
            <Ic n="i-list" sm /> فتح العمليات
          </Link>
        </div>
      </div>

      <KpiRow kpis={kpis} sparkIn={data?.series.in} sparkOut={data?.series.out} />

      <div className="charts">
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h3>حركة الوارد والصادر</h3>
              <div className="sub">آخر {days} يومًا · بالمليون ل.س</div>
            </div>
          </div>
          <div className="legend">
            <span><i style={{ background: 'var(--primary-600)' }} /> وارد</span>
            <span><i style={{ background: 'var(--gold-400)' }} /> صادر</span>
          </div>
          {data ? (
            <AreaChart labels={data.series.labels} inSeries={data.series.in} outSeries={data.series.out} />
          ) : (
            <div style={{ height: 250, display: 'grid', placeItems: 'center', color: 'var(--txt-3)' }}>جارٍ التحميل…</div>
          )}
        </div>

        <div className="card panel">
          <div className="panel-head">
            <div>
              <h3>توزيع الحالات</h3>
              <div className="sub">حسب عدد العمليات</div>
            </div>
          </div>
          {data ? <Donut counts={data.statusCounts} /> : <div style={{ height: 250, display: 'grid', placeItems: 'center', color: 'var(--txt-3)' }}>…</div>}
        </div>
      </div>

      <div className="card panel">
        <div className="panel-head">
          <div>
            <h3>أحدث العمليات</h3>
            <div className="sub">آخر 7 عمليات مسجّلة</div>
          </div>
          <div className="tools">
            <Link className="btn btn-sm btn-ghost" href="/operations">عرض الكل <Ic n="i-chev-l" xs /></Link>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>رقم العملية</th><th>العميل / الوصف</th><th>النوع</th><th>الوسيلة</th>
                <th>المبلغ</th><th>الاتجاه</th><th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--txt-3)', padding: 26 }}>جارٍ التحميل…</td></tr>
              )}
              {!loading && (data?.recent ?? []).map((o) => {
                const st = STATUS_META[o.status];
                return (
                  <tr key={o.id} onClick={() => setDrawerId(o.id)}>
                    <td><span className="cell-id">{o.id}</span><span className="cell-sub">{o.ref}</span></td>
                    <td><b style={{ fontWeight: 600 }}>{o.customer}</b><span className="cell-sub">{o.note}</span></td>
                    <td>{o.type}</td>
                    <td><span className="pill-method">{o.method}</span></td>
                    <td><span className={`amount ${o.dir === 'in' ? 'in-c' : 'out-c'}`}>{money(o.amount)}<small>{CURRENCY}</small></span></td>
                    <td>
                      <span className={`dir ${o.dir}`}>
                        <Ic n={o.dir === 'in' ? 'i-in' : 'i-out'} xs />
                        {o.dir === 'in' ? 'وارد' : 'صادر'}
                      </span>
                    </td>
                    <td><span className={`badge ${st.cls}`}><i />{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        op={(data?.recent ?? []).find((o) => o.id === drawerId) ?? null}
        onClose={() => setDrawerId(null)}
        onPost={async () => {
          toast('يمكن الترحيل من صفحة العمليات', 'warn');
          setDrawerId(null);
        }}
        onToast={toast}
      />
      <div style={{ height: 8 }} />
      <p style={{ color: 'var(--txt-3)', fontSize: 11.5, marginTop: 10 }}>
        آخر تحديث: {data ? fmtDateTime(new Date().toISOString()) : '—'}
      </p>
    </>
  );
}
