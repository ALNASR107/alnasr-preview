'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Operation, OperationsResponse, SortDir, SortKey } from '@/lib/types';
import { METHODS, STATUS_KEYS, STATUS_META, TONE, TYPES } from '@/lib/types';
import { CURRENCY, fmtDateTime, money, num } from '@/lib/format';
import { fetchOperations, updateOperationStatus } from '@/lib/api';
import { Ic } from './Icons';
import KpiRow from './KpiRow';
import Drawer from './Drawer';
import { useToast } from './Toaster';

export default function OperationsView() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const toast = useToast();

  const [statuses, setStatuses] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [method, setMethod] = useState('');
  const [dir, setDir] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  const [data, setData] = useState<OperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);

  /* ---------- جلب البيانات من الـ API ---------- */
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetchOperations(
      { q, status: statuses, type, method, dir, from, to, sort: sortKey, order: sortDir, page, perPage },
      ctrl.signal,
    )
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [q, statuses, type, method, dir, from, to, sortKey, sortDir, page, perPage, reloadKey]);

  const rows = data?.rows ?? [];
  const drawerOp = useMemo(
    () => (data?.rows ?? []).find((o) => o.id === drawerId) ?? null,
    [data, drawerId],
  );

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const reset = () => {
    setStatuses([]);
    setType('');
    setMethod('');
    setDir('');
    setFrom('');
    setTo('');
    setPage(1);
    toast('تم مسح كل الفلاتر', 'info');
  };

  /* ---------- التحديد ---------- */
  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pageIds = rows.map((o) => o.id);
  const selOnPage = pageIds.filter((id) => selected.includes(id)).length;
  const allSelected = pageIds.length > 0 && selOnPage === pageIds.length;
  const partial = selOnPage > 0 && !allSelected;

  /* ---------- إجراءات ---------- */
  const csv = (list: Operation[], name: string) => {
    const head = ['رقم العملية', 'التاريخ', 'العميل', 'الوصف', 'النوع', 'الوسيلة', 'المبلغ', 'العملة', 'الاتجاه', 'الحالة', 'المرجع', 'الحساب', 'المستخدم'];
    const lines = list.map((o) =>
      [
        o.id, fmtDateTime(o.date), o.customer, o.note, o.type, o.method,
        o.amount, CURRENCY, o.dir === 'in' ? 'وارد' : 'صادر',
        STATUS_META[o.status].label, o.ref, o.account, o.user,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob(['\uFEFF' + [head.join(','), ...lines].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 400);
  };

  async function exportAll() {
    const res = await fetchOperations({ q, status: statuses, type, method, dir, from, to, sort: sortKey, order: sortDir, page: 1, perPage: 500 });
    csv(res.rows, `amanah-operations-${new Date().toISOString().slice(0, 10)}.csv`);
    toast('تم تجهيز ملف CSV للتنزيل');
  }

  async function postToSheet(ids: string[]) {
    setBusy(true);
    try {
      const r = await fetch('/api/sheet/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const res = await r.json();
      if (res.added) {
        toast(`تم ترحيل ${res.added} حركة إلى شيت الترحيل`, 'ok');
        setSelected([]);
        setReloadKey((k) => k + 1);
      } else {
        toast(res.skipped ? 'هذه الحركات موجودة في الشيت مسبقًا' : 'تعذّر الترحيل', 'warn');
      }
    } finally {
      setBusy(false);
    }
  }

  async function previewAllReview() {
    setBusy(true);
    try { const r=await fetch('/api/operations/post-review',{cache:'no-store'}); const d=await r.json(); if(!r.ok) throw new Error(d.error || 'تعذّر تحميل عمليات المراجعة'); if(!d.count) {toast('لا توجد عمليات بحالة مراجعة','info');return;} setReviewIds(d.ids); }
    catch(e){toast((e as Error).message,'err');} finally {setBusy(false);}
  }
  async function confirmAllReview() {
    if(!reviewIds) return; setBusy(true);
    try { const r=await fetch('/api/operations/post-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:reviewIds})});const d=await r.json();if(!r.ok)throw new Error(d.error || 'تعذّر الترحيل');setReviewIds(null);setReloadKey(k=>k+1);toast(`تم ترحيل ${d.added} · المتخطى ${d.skipped + d.changed} · الأخطاء ${d.errors.length}`,d.errors.length?'warn':'ok'); }
    catch(e){toast((e as Error).message,'err');} finally {setBusy(false);}
  }

  async function bulk(action: 'review' | 'ignore' | 'export') {
    if (!selected.length) return;
    if (action === 'export') {
      const res = await fetchOperations({ q, status: statuses, type, method, dir, from, to, page: 1, perPage: 500 });
      csv(res.rows.filter((o) => selected.includes(o.id)), 'selected-operations.csv');
      toast(`تم تصدير ${selected.length} عملية`);
      return;
    }
    setBusy(true);
    await Promise.all(selected.map((id) => updateOperationStatus(id, action === 'review' ? 'review' : 'ignored').catch(() => null)));
    setBusy(false);
    setSelected([]);
    setReloadKey((k) => k + 1);
    toast(action === 'review' ? 'تم إرسال العمليات إلى المراجعة' : 'تم تجاهل العمليات المحددة', action === 'review' ? 'ok' : 'warn');
  }

  async function post(op: Operation) {
    if (op.status === 'posted') {
      toast('هذه العملية مرحّلة مسبقاً', 'warn');
      return;
    }
    setBusy(true);
    try {
      await updateOperationStatus(op.id, 'posted');
      setDrawerId(null);
      setReloadKey((k) => k + 1);
      toast(`تم اعتماد وترحيل العملية ${op.id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  const activeFilters = [
    statuses.length ? `${statuses.length} حالة` : '',
    type,
    method,
    dir ? (dir === 'in' ? 'وارد' : 'صادر') : '',
    from ? `من ${from}` : '',
    to ? `إلى ${to}` : '',
    q ? `بحث: ${q}` : '',
  ].filter(Boolean);

  const sortInd = (k: SortKey) => (
    <span className="sort-ind" style={{ opacity: sortKey === k ? 1 : 0.3 }}>
      {sortKey === k && sortDir === 'asc' ? '▴' : '▾'}
    </span>
  );

  return (
    <>
      {reviewIds && <div role="dialog" aria-modal="true" aria-label="تأكيد ترحيل عمليات المراجعة" style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.55)',display:'grid',placeItems:'center',padding:20}}><div className="card" style={{padding:20,maxWidth:520,width:'100%'}}><h3>ترحيل كل عمليات المراجعة؟</h3><p>سيتم اعتماد وترحيل <b>{reviewIds.length}</b> عملية من كل المجموعات والأيام، بغض النظر عن الفلاتر.</p><p><b>تنبيه:</b> قد تتضمن عمليات متشابهة أو صوراً قُرئت بشكل خاطئ، وقد يؤدي ترحيلها لتكرار أو أخطاء. الرسائل التي لم تُنشأ منها عملية ليست ضمن هذا الزر.</p><div style={{display:'flex',gap:8}}><button className="btn" onClick={()=>setReviewIds(null)} disabled={busy}>إلغاء</button><button className="btn btn-primary" onClick={confirmAllReview} disabled={busy}>تأكيد ترحيل الكل</button></div></div></div>}
      <div className="page-head">
        <div>
          <h1>العمليات</h1>
          <p>
            سجل موحّد لكل الحركات المالية — إجمالي <b className="num">{num(data?.allTotal ?? 0)}</b> عملية{' '}
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                color: 'var(--wait)', background: 'var(--wait-bg)', border: '1px solid var(--wait-line)',
                borderRadius: 999, padding: '1px 8px', marginInlineStart: 6,
              }}
            >
              بيانات تجريبية
            </span>
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={previewAllReview} disabled={busy}>ترحيل كل عمليات المراجعة</button>
          <button className="btn" onClick={() => setReloadKey((k) => k + 1)}>
            <Ic n="i-refresh" sm /> تحديث
          </button>
          <a className="btn" href="/sheet" style={{ textDecoration: 'none' }}>
            <Ic n="i-file" sm /> شيت الترحيل
          </a>
          <button className="btn" onClick={exportAll}>
            <Ic n="i-download" sm /> تصدير CSV
          </button>
          <button className="btn btn-primary" onClick={() => toast('نموذج إنشاء عملية جديدة (تجريبي)', 'info')}>
            <Ic n="i-plus" sm /> عملية جديدة
          </button>
        </div>
      </div>

      <KpiRow kpis={data?.kpis ?? { sumIn: 0, sumOut: 0, net: 0, needsAction: 0, pending: 0, postedCount: 0, postRate: 0, total: 0 }} />

      <div className="card panel" style={{ marginTop: 16 }}>
        <div className="filters">
          <div className="field">
            <label htmlFor="fType">نوع العملية</label>
            <select id="fType" value={type} onChange={(e) => applyFilter(() => setType(e.target.value))}>
              <option value="">كل الأنواع</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fMethod">الوسيلة</label>
            <select id="fMethod" value={method} onChange={(e) => applyFilter(() => setMethod(e.target.value))}>
              <option value="">كل الوسائل</option>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fDir">الاتجاه</label>
            <select id="fDir" value={dir} onChange={(e) => applyFilter(() => setDir(e.target.value))}>
              <option value="">الوارد والصادر</option>
              <option value="in">وارد فقط</option>
              <option value="out">صادر فقط</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="fFrom">من تاريخ</label>
            <input id="fFrom" type="date" value={from} onChange={(e) => applyFilter(() => setFrom(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="fTo">إلى تاريخ</label>
            <input id="fTo" type="date" value={to} onChange={(e) => applyFilter(() => setTo(e.target.value))} />
          </div>
          <button className="btn btn-sm btn-ghost" style={{ height: 32 }} onClick={reset}>
            <Ic n="i-x" xs /> مسح الفلاتر
          </button>
          <div className="filter-summary">
            <span>
              عرض <b className="num">{num(data?.total ?? 0)}</b> من <b className="num">{num(data?.allTotal ?? 0)}</b>
            </span>
          </div>
        </div>

        <div className="filters" style={{ background: 'var(--surface)' }}>
          <div className="status-chips">
            {STATUS_KEYS.map((k) => {
              const on = statuses.includes(k);
              return (
                <button
                  key={k}
                  className={`chip ${on ? 'on' : ''}`}
                  style={{ ['--c' as string]: TONE[k] }}
                  onClick={() => applyFilter(() => setStatuses((prev) => (on ? prev.filter((s) => s !== k) : [...prev, k])))}
                >
                  <i />
                  {STATUS_META[k].label} <span className="num" style={{ opacity: 0.65 }}>{data?.statusCounts?.[k] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <div className="filter-summary">
            <span className="muted">{activeFilters.length ? `فلاتر مطبّقة: ${activeFilters.join(' · ')}` : 'لا توجد فلاتر مطبّقة'}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 38 }}>
                  <span
                    className={`cbx ${allSelected ? 'on' : ''} ${partial ? 'part' : ''}`}
                    role="checkbox"
                    aria-checked={allSelected}
                    tabIndex={0}
                    onClick={() =>
                      setSelected((prev) =>
                        allSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds])),
                      )
                    }
                  >
                    <svg><use href="#i-check" /></svg>
                  </span>
                </th>
                <th className="sortable" onClick={() => { setSortKey('id'); setSortDir(sortKey === 'id' && sortDir === 'desc' ? 'asc' : 'desc'); }}>رقم العملية {sortInd('id')}</th>
                <th className="sortable" onClick={() => { setSortKey('date'); setSortDir(sortKey === 'date' && sortDir === 'desc' ? 'asc' : 'desc'); }}>التاريخ {sortInd('date')}</th>
                <th>العميل / الوصف</th>
                <th>النوع</th>
                <th>الوسيلة</th>
                <th className="sortable" onClick={() => { setSortKey('amount'); setSortDir(sortKey === 'amount' && sortDir === 'desc' ? 'asc' : 'desc'); }}>المبلغ {sortInd('amount')}</th>
                <th>الاتجاه</th>
                <th>الحالة</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty">
                      <div className="e-ic"><Ic n="i-alert" style={{ width: 26, height: 26 }} /></div>
                      <b>تعذّر تحميل البيانات</b>
                      <div>{error}</div>
                    </div>
                  </td>
                </tr>
              )}

              {!error && loading && (
                <>{Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="row-loading">
                    <td><span className="skel" style={{ display: 'block', width: 16, height: 16 }} /></td>
                    <td><span className="skel" style={{ display: 'block', width: 90, height: 12 }} /></td>
                    <td><span className="skel" style={{ display: 'block', width: 80, height: 12 }} /></td>
                    <td><span className="skel" style={{ display: 'block', width: 160, height: 12 }} /></td>
                    <td><span className="skel" style={{ display: 'block', width: 54, height: 12 }} /></td>
                    <td><span className="skel" style={{ display: 'block', width: 48, height: 12 }} /></td>
                    <td><span className="skel" style={{ display: 'block', width: 90, height: 12 }} /></td>
                    <td><span className="skel" style={{ display: 'block', width: 54, height: 12 }} /></td>
                    <td><span className="skel" style={{ display: 'block', width: 64, height: 18, borderRadius: 999 }} /></td>
                    <td />
                  </tr>
                ))}</>
              )}

              {!error && !loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty">
                      <div className="e-ic"><Ic n="i-search" style={{ width: 26, height: 26 }} /></div>
                      <b>لا توجد عمليات مطابقة</b>
                      <div>جرّب تعديل الفلاتر أو مسحها لعرض كل العمليات.</div>
                    </div>
                  </td>
                </tr>
              )}

              {!error && !loading && rows.map((o) => {
                const st = STATUS_META[o.status];
                const isSel = selected.includes(o.id);
                return (
                  <tr key={o.id} className={isSel ? 'selected' : ''} onClick={() => setDrawerId(o.id)}>
                    <td>
                      <span
                        className={`cbx ${isSel ? 'on' : ''}`}
                        role="checkbox"
                        aria-checked={isSel}
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(o.id); }}
                      >
                        <svg><use href="#i-check" /></svg>
                      </span>
                    </td>
                    <td>
                      <span className="cell-id">{o.id}</span>
                      <span className="cell-sub">{o.ref}</span>
                    </td>
                    <td>
                      <span className="num">{fmtDateTime(o.date).split(' · ')[0]}</span>
                      <span className="cell-sub num">{fmtDateTime(o.date).split(' · ')[1]}</span>
                    </td>
                    <td>
                      <b style={{ fontWeight: 600 }}>{o.customer}</b>
                      <span className="cell-sub">{o.note}</span>
                    </td>
                    <td>{o.type}</td>
                    <td><span className="pill-method">{o.method}</span></td>
                    <td>
                      <span className={`amount ${o.dir === 'in' ? 'in-c' : 'out-c'}`}>
                        {money(o.amount)}<small>{o.currency}</small>
                      </span>
                    </td>
                    <td>
                      <span className={`dir ${o.dir}`}>
                        <Ic n={o.dir === 'in' ? 'i-in' : 'i-out'} xs />
                        {o.dir === 'in' ? 'وارد' : 'صادر'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${st.cls}`}><i />{st.label}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button title="طباعة" onClick={(e) => { e.stopPropagation(); toast(`تم إرسال ${o.id} إلى الطباعة`, 'info'); }}>
                          <Ic n="i-print" sm />
                        </button>
                        <button title="تفاصيل" onClick={(e) => { e.stopPropagation(); setDrawerId(o.id); }}>
                          <Ic n="i-more" sm />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="table-foot">
          <div className="per-page">
            <span>صفوف لكل صفحة</span>
            <select value={perPage} onChange={(e) => applyFilter(() => setPerPage(Number(e.target.value)))}>
              {[10, 12, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="السابق">
              <Ic n="i-chev-r" xs />
            </button>
            {(() => {
              const pages = data?.pages ?? 1;
              const win: (number | '…')[] = [];
              for (let p = 1; p <= pages; p++) {
                if (p === 1 || p === pages || Math.abs(p - page) <= 1) win.push(p);
                else if (win[win.length - 1] !== '…') win.push('…');
              }
              return win.map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} style={{ color: 'var(--txt-3)', padding: '0 4px' }}>…</span>
                ) : (
                  <button key={p} className={p === page ? 'on' : ''} onClick={() => setPage(p)}>{p}</button>
                ),
              );
            })()}
            <button disabled={page >= (data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)} aria-label="التالي">
              <Ic n="i-chev-l" xs />
            </button>
          </div>
        </div>
      </div>

      <div className={`bulkbar ${selected.length ? 'show' : ''}`}>
        <b><span className="num">{selected.length}</span> عملية محددة</b>
        <div className="b-actions">
          <button className="btn" onClick={() => postToSheet(selected)} disabled={busy}><Ic n="i-file" xs /> ترحيل إلى الشيت</button>
          <button className="btn" onClick={() => bulk('export')} disabled={busy}><Ic n="i-download" xs /> تصدير</button>
          <button className="btn" onClick={() => bulk('review')} disabled={busy}><Ic n="i-clock" xs /> إرسال للمراجعة</button>
          <button className="btn" onClick={() => bulk('ignore')} disabled={busy}><Ic n="i-x" xs /> تجاهل</button>
        </div>
        <button className="btn" onClick={() => setSelected([])} aria-label="إلغاء التحديد"><Ic n="i-x" xs /></button>
      </div>

      <Drawer op={drawerOp} busy={busy} onClose={() => setDrawerId(null)} onPost={post} onToast={toast} />
    </>
  );
}
