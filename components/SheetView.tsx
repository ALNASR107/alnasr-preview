'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SheetLine } from '@/lib/sheet-shared';
import { COST_CENTERS } from '@/lib/sheet-shared';
import { CURRENCY, money, num } from '@/lib/format';
import { Ic } from './Icons';
import HistoryStatus from './HistoryStatus';
import { useToast } from './Toaster';

type Totals = {
  count: number;
  debit: number;
  credit: number;
  diff: number;
  balanced: boolean;
  rowsValid: boolean;
  rewards: number;
  byCurrency?: CurTotal[];
};
type Pending = { id: string; customer: string; amount: number; currency: string; dir: 'in' | 'out' };
type AutoPost = { enabled: boolean; intervalMin: number; lastRun: string | null; lastAdded: number | null; totalRuns: number };
type SheetInfo = { id: string; name: string; kind: string; jid?: string; date?: string; count: number };
type CurTotal = { currency: string; count: number; debit: number; credit: number; net: number };
type DaySummary = { date: string; label: string; count: number; byCurrency: CurTotal[]; sheets: { id: string; name: string; count: number }[]; rewards: number };
type DailyState = { enabled: boolean; at: string; lastSent: string | null; today: string; to: string };
type Payload = {
  sheet: string;
  day: string;
  dayParam: string;
  days: string[];
  today: string;
  yesterday: string;
  daySummary?: DaySummary;
  daily?: DailyState;
  sheets: SheetInfo[];
  lines: SheetLine[];
  totals: Totals;
  pending: Pending[];
  autoPost?: AutoPost;
};

export default function SheetView() {
  const toast = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removeLine, setRemoveLine] = useState<SheetLine | null>(null);
  const [confirmSelected, setConfirmSelected] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<'single' | 'double'>('single');
  const [waSending, setWaSending] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [csvModal, setCsvModal] = useState<string | null>(null);
  const [sandboxed, setSandboxed] = useState(false);
  const [sheet, setSheet] = useState<string>('all');
  const [day, setDay] = useState<string>('today');
  const [historyBusy, setHistoryBusy] = useState(false);
  const requestId = useRef(0);

  /**
   * تنزيل Excel عبر fetch + Blob (أكثر موثوقية من رابط <a download>).
   * ملاحظة: المعاينة داخل التطبيق تعمل في إطار مضمّن (sandbox) قد يمنع التنزيل —
   * لذلك نُظهر تنبيهًا مع بديل «نسخ CSV» عند فشل التنزيل.
   */
  async function downloadExcel() {
    setExcelBusy(true);
    try {
      const url = `/api/sheet/export?mode=${exportMode}&sheet=${encodeURIComponent(sheet)}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`فشل التصدير (${r.status}) ${txt.slice(0, 120)}`);
      }
      const blob = await r.blob();
      const cd = r.headers.get('Content-Disposition') ?? '';
      const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="([^"]+)"/i);
      const name = m ? decodeURIComponent(m[1]) : `nasr-sheet-${exportMode}.xlsx`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);

      const sandboxed = (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();

      toast(
        sandboxed
          ? 'طلبنا تنزيل الملف. إن لم ينزل، فالمعاينة داخل التطبيق تمنعه — افتح التطبيق في نافذة مستقلة أو استخدم «نسخ CSV».'
          : `تم تجهيز الملف: ${name}`,
        sandboxed ? 'warn' : 'ok',
      );
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setExcelBusy(false);
    }
  }

  /** بناء نص CSV لسطور الشيت الحالية */
  function buildCsv() {
    const head = ['الحساب', 'البيان', 'مدين', 'دائن', 'العملة', 'التعادل', 'المكافئ', 'مركز التكلفة', 'التاريخ', 'المبلغ', 'الحساب المقابل'];
    const rows = (data?.lines ?? []).map((l) => [
      l.account,
      l.statement,
      l.debit || '',
      l.credit || '',
      l.currency,
      l.fx?.usd ?? '',
      l.fx?.rate ?? '',
      l.costCenter,
      l.date,
      l.amount,
      l.counterAccount,
    ]);
    return [head, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  /** بديل يعمل داخل المعاينة: نافذة فيها النص كاملًا للنسخ أو الحفظ */
  function openCsvFallback() {
    const csv = buildCsv();
    setCsvModal(csv);
    // محاولة نسخ تلقائية (قد يمنعها الإطار المضمّن)
    try {
      void navigator.clipboard.writeText('\uFEFF' + csv).then(
        () => toast('نُسخت السطور إلى الحافظة', 'ok'),
        () => undefined,
      );
    } catch {
      /* تجاهل */
    }
  }

  // هل نحن داخل إطار مضمّن مُقيَّد (معاينة التطبيق)؟ التنزيل يُحجب هناك.
  useEffect(() => {
    try {
      setSandboxed(window.self !== window.top);
    } catch {
      setSandboxed(true);
    }
  }, []);

  /** إرسال ملخّص اليوم إلى واتساب */
  async function sendDailySummary() {
    setWaSending(true);
    try {
      const date =
        day === 'today' ? data?.today : day === 'yesterday' ? data?.yesterday : day === 'all' ? data?.today : day;
      const to = window.prompt('إلى أي رقم أو مجموعة؟ (اتركه فارغًا لاستخدام الإعداد الافتراضي)', '') ?? '';
      const r = await fetch('/api/summary/daily/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, to: to.trim() || undefined }),
      });
      const d = await r.json();
      toast(d.ok ? 'أُرسل ملخّص اليوم ✅' : d.error ?? 'فشل الإرسال', d.ok ? 'ok' : 'err');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setWaSending(false);
    }
  }

  /** يرسل الشيت إلى رقم/مجموعة واتساب (يُفضّل ضبط WA_AUTO_SUMMARY_TO أو مجموعة) */
  async function sendToWhatsApp() {
    setWaSending(true);
    try {
      const to = window.prompt('إلى أي رقم أو مجموعة واتساب؟ (بصيغة دولية بدون +، أو اتركه فارغًا لاستخدام الإعداد الافتراضي)', '') ?? '';
      const r = await fetch('/api/integrations/whatsapp/web/send-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim() || undefined, limit: 30, mode: exportMode, sheet }),
      });
      const d = await r.json();
      toast(d.ok ? 'أُرسل الشيت إلى واتساب ✅' : d.error ?? 'فشل الإرسال', d.ok ? 'ok' : 'err');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setWaSending(false);
    }
  }

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const r = await fetch(`/api/sheet?sheet=${encodeURIComponent(sheet)}&day=${encodeURIComponent(day)}`, {
        cache: 'no-store',
      });
      if (!r.ok) throw new Error('تعذر تحميل الشيت');
      const result = (await r.json()) as Payload;
      if (id === requestId.current) setData(result);
    } catch (e) {
      if (id === requestId.current) toast((e as Error).message, 'err');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [toast, sheet, day]);

  useEffect(() => {
    setSelected([]);
    void load();
    return () => { requestId.current++; };
  }, [load]);

  async function importYesterday() {
    setHistoryBusy(true);
    try {
      const status = await (await fetch('/api/integrations/whatsapp/web/history-yesterday', { cache: 'no-store' })).json();
      if (!status.connected) { toast('اربط واتساب أولاً وانتظر مزامنة الرسائل', 'warn'); return; }
      if (!status.pending) { toast(`لا توجد حركات مؤهلة جديدة من ${status.date} ضمن الرسائل التي زامنها واتساب. قد تكون المزامنة غير مكتملة.`, 'warn'); return; }
      if (!window.confirm(`وُجدت ${status.pending} رسالة بصيغة حركة مالية بتاريخ ${status.date}. هل تريد ترحيلها إلى شيتاتها بتاريخها الأصلي؟ قد لا تشمل المزامنة كل الرسائل.`)) return;
      const response = await fetch('/api/integrations/whatsapp/web/history-yesterday', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذّر الترحيل');
      toast(`تم ترحيل ${result.added} حركة، وتُخطّي ${result.skipped}. راجع السطور قبل اعتمادها.`, result.added ? 'ok' : 'warn');
      setSheet('all'); setDay('yesterday');
      await load();
    } catch (e) { toast((e as Error).message, 'err'); }
    finally { setHistoryBusy(false); }
  }

  /** إدارة الشيتات: إنشاء / إعادة تسمية / حذف */
  async function newSheet() {
    const name = window.prompt('اسم الشيت الجديد', '');
    if (!name?.trim()) return;
    const r = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const d = await r.json();
    if (d.sheet) {
      toast('أُنشئ الشيت', 'ok');
      setSheet(d.sheet.id);
    } else toast(d.error ?? 'فشل الإنشاء', 'err');
  }

  async function renameSheet() {
    if (sheet === 'all') return;
    const current = data?.sheets.find((x) => x.id === sheet)?.name ?? '';
    const name = window.prompt('الاسم الجديد للشيت', current);
    if (!name?.trim()) return;
    const r = await fetch(`/api/sheets/${encodeURIComponent(sheet)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const d = await r.json();
    toast(d.sheet ? 'تم تغيير الاسم' : d.error ?? 'فشل', d.sheet ? 'ok' : 'err');
    await load();
  }

  async function deleteSheet() {
    if (sheet === 'all') return;
    if (!window.confirm('حذف هذا الشيت وكل سطوره؟')) return;
    const r = await fetch(`/api/sheets/${encodeURIComponent(sheet)}`, { method: 'DELETE' });
    const d = await r.json();
    toast(d.ok ? `حُذف الشيت (${d.removedLines} سطرًا)` : d.error ?? 'فشل الحذف', d.ok ? 'ok' : 'err');
    setSheet('all');
  }

  /** حذف كل الحركات في الشيت الحالي (أو كل الشيتات) */
  async function clearAll() {
    const scope = sheet === 'all' ? 'كل الشيتات وكل السطور' : 'كل سطور هذا الشيت';
    if (!window.confirm(`سيتم حذف ${scope} نهائيًا. متابعة؟`)) return;
    const r = await fetch(`/api/sheet?sheet=${encodeURIComponent(sheet)}`, { method: 'DELETE' });
    const d = await r.json();
    toast(d.ok ? `حُذف ${d.removed} سطرًا` : d.error ?? 'فشل', d.ok ? 'ok' : 'err');
    setSelected([]);
    await load();
  }

  async function postAll(ids?: string[]) {
    setBusy(true);
    try {
      const r = await fetch('/api/sheet/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids?.length ? { ids, sheet } : { all: true, sheet }),
      });
      const res = await r.json();
      toast(
        res.added ? `تم ترحيل ${res.added} حركة إلى الشيت` : 'لا توجد حركات جديدة للترحيل',
        res.added ? 'ok' : 'warn',
      );
      setSelected([]);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patch(line: SheetLine, patch: Partial<Pick<SheetLine, 'costCenter' | 'counterAccount' | 'reward'>>) {
    setData((d) =>
      d
        ? {
            ...d,
            lines: d.lines.map((l) =>
              l.id === line.id
                ? { ...l, ...patch, balance: l.amount - (l.debit + l.credit) }
                : l,
            ),
          }
        : d,
    );
    await fetch(`/api/sheet/${encodeURIComponent(line.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => null);
  }

  async function confirmRemoveLine() {
    if (!removeLine) return;
    setBusy(true);
    try {
      const r=await fetch(`/api/sheet/${encodeURIComponent(removeLine.id)}`,{method:'DELETE'});
      const d=await r.json();
      if(!r.ok || !d.removed) throw new Error(d.error || 'السطر غير موجود');
      setRemoveLine(null); await load(); toast('حُذف السطر من الشيت وبقيت العملية في السجل', 'ok');
    } catch(e) { toast((e as Error).message,'err'); } finally { setBusy(false); }
  }

  async function removeSelected() {
    if (!selected.length) return;
    setBusy(true);
    try {
      const outcomes=await Promise.all(selected.map(async id=>{ try { const r=await fetch(`/api/sheet/${encodeURIComponent(id)}`, { method:'DELETE' }); const d=await r.json(); return r.ok && d.removed===1; } catch { return false; } }));
      const ok=outcomes.filter(Boolean).length; setConfirmSelected(false); setSelected([]); await load();
      toast(`حُذف ${ok} سطر · تعذّر ${outcomes.length-ok}`,ok===outcomes.length?'ok':'warn');
    } finally {setBusy(false);}
  }

  const matchesSelection = data?.sheet === sheet && data?.dayParam === day;
  const totals = matchesSelection ? data?.totals : undefined;
  const lines = matchesSelection ? data?.lines ?? [] : [];
  const allSel = lines.length > 0 && selected.length === lines.length;

  return (
    <>
      {confirmSelected && <div role="dialog" aria-modal="true" aria-label="تأكيد حذف السطور المحددة" style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.55)',display:'grid',placeItems:'center',padding:20}}><div className="card" style={{padding:20,maxWidth:460,width:'100%'}}><h3>حذف {selected.length} سطر من الشيت؟</h3><p>تبقى العمليات والرسائل ولن تعود السطور المحذوفة تلقائياً. السطور المرتبطة غير المحددة ستبقى.</p><div style={{display:'flex',gap:8}}><button className="btn" onClick={()=>setConfirmSelected(false)} disabled={busy}>إلغاء</button><button className="btn btn-primary" onClick={removeSelected} disabled={busy}>تأكيد الحذف</button></div></div></div>}
      {removeLine && <div role="dialog" aria-modal="true" aria-label="تأكيد حذف السطر" style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.55)',display:'grid',placeItems:'center',padding:20}}><div className="card" style={{padding:20,maxWidth:460,width:'100%'}}><h3>حذف السطر من الشيت؟</h3><p>{removeLine.opId} · {money(removeLine.amount)} {removeLine.currency}</p><p>سيُحذف هذا السطر فقط. تبقى العملية ورسالة واتساب، ولن يُعاد السطر تلقائياً. السطر المرتبط بمجموعة ثانية، إن وجد، سيبقى.</p><div style={{display:'flex',gap:8}}><button className="btn" onClick={()=>setRemoveLine(null)} disabled={busy}>إلغاء</button><button className="btn btn-primary" onClick={confirmRemoveLine} disabled={busy}>تأكيد الحذف</button></div></div></div>}
      <div className="page-head">
        <div>
          <h1>شيت الترحيل</h1>
          <p>
            الحركات المرحّلة محوّلة إلى سطور محاسبية جاهزة للتصدير —{' '}
            <b className="num">{num(totals?.count ?? 0)}</b> سطر
            {data?.pending?.length ? (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                  color: 'var(--wait)', background: 'var(--wait-bg)', border: '1px solid var(--wait-line)',
                  borderRadius: 999, padding: '1px 8px', marginInlineStart: 6,
                }}
              >
                {data.pending.length} حركة بانتظار الترحيل
              </span>
            ) : null}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => load()} disabled={busy}>
            <Ic n="i-refresh" sm /> تحديث
          </button>
          <button className="btn btn-primary" onClick={() => postAll()} disabled={busy || !data?.pending?.length}>
            <Ic n="i-in" sm /> {busy ? 'جارٍ الترحيل…' : 'ترحيل كل الحركات المرحّلة'}
          </button>
          <button className="btn" onClick={importYesterday} disabled={historyBusy} title="ترحيل الرسائل المؤهلة التي زامنها واتساب من الأمس فقط">
            <Ic n="i-in" sm /> {historyBusy ? 'جارٍ الفحص…' : 'ترحيل حركات مبارح'}
          </button>
          <div className="seg" title="شكل ملف Excel">
            <button className={exportMode === 'single' ? 'on' : ''} onClick={() => setExportMode('single')}>سطر واحد</button>
            <button className={exportMode === 'double' ? 'on' : ''} onClick={() => setExportMode('double')}>قيد مزدوج</button>
          </div>
          <button className="btn btn-primary" onClick={downloadExcel} disabled={excelBusy}>
            <Ic n="i-download" sm /> {excelBusy ? 'جارٍ التجهيز…' : 'تصدير Excel'}
          </button>
          <button className="btn" onClick={openCsvFallback} title="عرض السطور كنص CSV لنسخها ولصقها في Excel">
            <Ic n="i-file" sm /> {sandboxed ? 'نسخ السطور (بديل)' : 'نسخ CSV'}
          </button>
          <button className="btn" onClick={sendToWhatsApp} disabled={waSending} title="إرسال الشيت كرسالة واتساب">
            <Ic n="i-bell" sm /> {waSending ? 'جارٍ الإرسال…' : 'إرسال إلى واتساب'}
          </button>
        </div>
      </div>

      <HistoryStatus />

      {sandboxed && (
        <div
          className="card"
          style={{
            padding: '10px 14px',
            marginBottom: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: 'var(--wait-bg)',
            border: '1px solid var(--wait-line)',
            fontSize: 12.5,
            color: 'var(--txt-2)',
            lineHeight: 1.8,
          }}
        >
          <Ic n="i-alert" sm style={{ color: 'var(--wait)' }} />
          <div>
            <b>المعاينة داخل التطبيق تمنع تنزيل الملفات.</b> زر «تصدير Excel» يعمل في المتصفح العادي
            (وعلى الخادم بعد النشر) — وهنا استخدم <b>«نسخ السطور (بديل)»</b> ثم الصقها في Excel،
            أو افتح الرابط في تبويب مستقل.
          </div>
        </div>
      )}

      {/* اليوم: شيت لكل يوم + مجموع اليوم */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="kpi-label" style={{ fontWeight: 600 }}>اليوم:</span>
          <button className={`tab-chip ${day === 'today' ? 'on' : ''}`} onClick={() => setDay('today')}>
            اليوم
          </button>
          <button className={`tab-chip ${day === 'yesterday' ? 'on' : ''}`} onClick={() => setDay('yesterday')}>
            أمس
          </button>
          {(data?.days ?? [])
            .filter((d) => d !== data?.today && d !== data?.yesterday)
            .slice(0, 5)
            .map((d) => (
              <button key={d} className={`tab-chip ${day === d ? 'on' : ''}`} onClick={() => setDay(d)}>
                <span dir="ltr">{d}</span>
              </button>
            ))}
          <button className={`tab-chip ${day === 'all' ? 'on' : ''}`} onClick={() => setDay('all')}>
            كل الأيام
          </button>

          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={sendDailySummary} disabled={waSending}>
              <Ic n="i-bell" xs /> {waSending ? 'جارٍ الإرسال…' : 'إرسال ملخّص اليوم'}
            </button>
          </div>
        </div>

        {/* مجموع اليوم لكل عملة */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <b style={{ fontSize: 13 }}>
            مجموع كل الشيتات — {(data?.daySummary?.label ?? 'اليوم')}:{' '}
            <span className="num">{(data?.daySummary?.count ?? 0).toLocaleString('en-US')}</span> حركة
          </b>
          {(data?.daySummary?.byCurrency ?? []).length === 0 ? (
            <span style={{ fontSize: 12.5, color: 'var(--txt-3)' }}>لا حركات في هذا اليوم بعد</span>
          ) : (
            (data?.daySummary?.byCurrency ?? []).map((c) => (
              <span
                key={c.currency}
                className="badge"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  padding: '5px 10px',
                  fontWeight: 600,
                }}
              >
                <b className="num" dir="ltr">{c.currency}</b>
                <span style={{ color: 'var(--out)' }}> مدين {num(c.debit)}</span>
                <span style={{ color: 'var(--in)' }}> · دائن {num(c.credit)}</span>
                <span style={{ color: 'var(--txt-2)' }}> · صافي {num(c.net)}</span>
              </span>
            ))
          )}
          {data?.daily && (
            <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>
              {data.daily.enabled
                ? `ملخّص تلقائي الساعة ${data.daily.at}${data.daily.lastSent ? ` · آخر إرسال ${data.daily.lastSent}` : ''}`
                : 'الملخّص التلقائي غير مفعّل (DAILY_REPORT_ENABLED=0)'}
            </span>
          )}
        </div>
      </div>

      {/* الشيتات: كل محادثة/مجموعة لها شيت */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="kpi-label" style={{ fontWeight: 600 }}>الشيتات:</span>

          <button
            className={`tab-chip ${sheet === 'all' ? 'on' : ''}`}
            onClick={() => setSheet('all')}
            title="عرض سطور كل الشيتات مجتمعة"
          >
            كل الشيتات
            <b className="num">{(data?.sheets ?? []).reduce((s2, x) => s2 + x.count, 0)}</b>
          </button>

          {(data?.sheets ?? []).map((s2) => (
            <button
              key={s2.id}
              className={`tab-chip ${sheet === s2.id ? 'on' : ''}`}
              onClick={() => setSheet(s2.id)}
              title={s2.jid ?? s2.name}
            >
              {s2.kind === 'group' ? '👥 ' : s2.kind === 'chat' ? '💬 ' : '📄 '}
              {s2.name}
              <b className="num">{s2.count}</b>
            </button>
          ))}

          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={newSheet}><Ic n="i-plus" xs /> شيت جديد</button>
            {sheet !== 'all' && (
              <>
                <button className="btn btn-sm" onClick={renameSheet}><Ic n="i-cog" xs /> إعادة تسمية</button>
                <button className="btn btn-sm" onClick={deleteSheet}><Ic n="i-x" xs /> حذف الشيت</button>
              </>
            )}
            <button className="btn btn-sm" onClick={clearAll} style={{ color: 'var(--out)' }}>
              <Ic n="i-x" xs /> حذف الحركات
            </button>
          </div>
        </div>
        {sheet !== 'all' && (
          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 8 }}>
            تعرض سطور شيت: <b>{data?.sheets.find((x) => x.id === sheet)?.name}</b>
            {data?.sheets.find((x) => x.id === sheet)?.jid ? (
              <span dir="ltr"> · {data?.sheets.find((x) => x.id === sheet)?.jid}</span>
            ) : null}
          </div>
        )}
      </div>

      {/* المؤشرات */}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        {[
          { label: 'سطور الشيت', value: num(totals?.count ?? 0), icon: 'i-list', accent: 'var(--primary-600)', bg: 'var(--primary-50)', note: 'حركة مرحّلة' },
          {
            label: 'مجموع مدين',
            value: num(totals?.byCurrency?.[0]?.debit ?? totals?.debit ?? 0),
            unit: totals?.byCurrency?.[0]?.currency ?? CURRENCY,
            icon: 'i-in',
            accent: 'var(--out)',
            bg: 'var(--out-bg)',
            note: (totals?.byCurrency ?? []).length > 1
              ? (totals?.byCurrency ?? []).map((c) => `${c.currency} ${num(c.debit)}`).join(' · ')
              : 'الجانب المدين',
          },
          {
            label: 'مجموع دائن',
            value: num(totals?.byCurrency?.[0]?.credit ?? totals?.credit ?? 0),
            unit: totals?.byCurrency?.[0]?.currency ?? CURRENCY,
            icon: 'i-out',
            accent: 'var(--in)',
            bg: 'var(--in-bg)',
            note: (totals?.byCurrency ?? []).length > 1
              ? (totals?.byCurrency ?? []).map((c) => `${c.currency} ${num(c.credit)}`).join(' · ')
              : 'الجانب الدائن',
          },
          {
            label: 'سلامة السطور',
            value: totals?.rowsValid ? 'سليمة' : 'تحتاج مراجعة',
            unit: '',
            icon: totals?.rowsValid ? 'i-check' : 'i-alert',
            accent: totals?.rowsValid ? 'var(--in)' : 'var(--out)',
            bg: totals?.rowsValid ? 'var(--in-bg)' : 'var(--out-bg)',
            note: totals?.rowsValid ? 'كل سطر بطرف واحد + حساب مقابل' : 'سطر بطرفين أو ناقص',
          },
        ].map((c) => (
          <div key={c.label} className="card kpi" style={{ ['--accent' as string]: c.accent, ['--accent-bg' as string]: c.bg }}>
            <div className="kpi-top">
              <div className="kpi-ic"><Ic n={c.icon} sm /></div>
              <div className="kpi-label">{c.label}</div>
            </div>
            <div className="kpi-val">{c.value}{c.unit ? <span>{c.unit}</span> : null}</div>
            <div className="kpi-foot">
              <span style={{ color: 'var(--txt-3)' }}>{c.note}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card panel">
        <div className="panel-head">
          <div>
            <h3>سطور الشيت</h3>
            <div className="sub">عدّل مركز التكلفة أو الحساب المقابل مباشرة — الحفظ تلقائي</div>
          </div>
          <div className="tools">
            {selected.length > 0 && (
              <button className="btn btn-sm" onClick={()=>setConfirmSelected(true)} disabled={busy}>
                <Ic n="i-x" xs /> إزالة {selected.length}
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={downloadExcel} disabled={excelBusy}>
              <Ic n="i-download" xs /> Excel
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table style={{ minWidth: 1280 }}>
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <span
                    className={`cbx ${allSel ? 'on' : ''}`}
                    role="checkbox"
                    aria-checked={allSel}
                    tabIndex={0}
                    onClick={() => setSelected(allSel ? [] : lines.map((l) => l.id))}
                  >
                    <svg><use href="#i-check" /></svg>
                  </span>
                </th>
                <th>الحساب</th>
                <th style={{ minWidth: 260 }}>البيان</th>
                <th style={{ color: 'var(--out)' }}>مدين</th>
                <th style={{ color: 'var(--in)' }}>دائن</th>
                <th>العملة</th>
                <th>التعادل</th>
                <th>المكافئ</th>
                <th>مركز التكلفة</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الحساب المقابل</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={13} style={{ textAlign: 'center', padding: 30, color: 'var(--txt-3)' }}>جارٍ التحميل…</td></tr>
              )}

              {!loading && lines.length === 0 && (
                <tr>
                  <td colSpan={13}>
                    <div className="empty">
                      <div className="e-ic"><Ic n="i-file" style={{ width: 26, height: 26 }} /></div>
                      <b>الشيت فارغ</b>
                      <div>رحّل الحركات من سجل العمليات، أو اضغط «ترحيل كل الحركات المرحّلة» أعلاه.</div>
                      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => postAll()} disabled={busy}>
                        <Ic n="i-in" sm /> ترحيل الآن
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && lines.map((l) => {
                const sel = selected.includes(l.id);
                return (
                  <tr key={l.id} className={sel ? 'selected' : ''}>
                    <td>
                      <span
                        className={`cbx ${sel ? 'on' : ''}`}
                        role="checkbox"
                        aria-checked={sel}
                        tabIndex={0}
                        onClick={() => setSelected((p) => (sel ? p.filter((x) => x !== l.id) : [...p, l.id]))}
                      >
                        <svg><use href="#i-check" /></svg>
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {l.account}
                      {l.source === 'whatsapp' ? (
                        <span
                          className="badge posted"
                          title="حركة واردة من واتساب"
                          style={{ marginInlineStart: 6, fontSize: 10, padding: '1px 6px' }}
                        >
                          واتساب
                        </span>
                      ) : null}
                    </td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 320, fontSize: 12.5, color: 'var(--txt-2)' }}>{l.statement}</td>
                    <td>
                      <span className="amount out-c">{l.debit ? money(l.debit) : '—'}</span>
                    </td>
                    <td>
                      <span className="amount in-c">{l.credit ? money(l.credit) : '—'}</span>
                    </td>
                    <td><span className="pill-method">{l.currency}</span></td>
                    <td className="num" title={l.fx ? `النشرة: ${l.fx.at}` : 'لا يوجد سعر قص سابق معروف'}>{l.fx ? `${l.fx.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD` : '—'}</td>
                    <td className="num">{l.fx ? l.fx.rate.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—'}</td>
                    <td>
                      <select
                        className="sheet-input"
                        defaultValue={l.costCenter}
                        onChange={(e) => patch(l, { costCenter: e.target.value })}
                        style={{ width: 128 }}
                      >
                        {COST_CENTERS.map((c) => <option key={c} value={c}>{c}</option>)}
                        {!COST_CENTERS.includes(l.costCenter) && <option value={l.costCenter}>{l.costCenter}</option>}
                      </select>
                    </td>
                    <td className="num" style={{ fontSize: 12 }}>{l.date}</td>
                    <td><span className="amount">{money(l.amount)}<small>{l.currency}</small></span></td>
                    <td>
                      <input
                        className="sheet-input"
                        defaultValue={l.counterAccount}
                        onBlur={(e) => patch(l, { counterAccount: e.target.value })}
                        style={{ width: 176 }}
                      />
                    </td>
                    <td><button className="btn btn-sm" aria-label={`حذف سطر ${l.opId}`} onClick={()=>setRemoveLine(l)} disabled={busy}>حذف</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="table-foot">
          <div className="per-page">
            <span>
              مدين <b className="num">{money(totals?.debit ?? 0)}</b> · دائن{' '}
              <b className="num">{money(totals?.credit ?? 0)}</b> {CURRENCY}
            </span>
          </div>
          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge ${totals?.rowsValid ? 'posted' : 'failed'}`}>
              <i />{totals?.rowsValid ? 'السطور سليمة' : 'تحتاج مراجعة'}
            </span>
            <button className="btn btn-sm" onClick={downloadExcel} disabled={excelBusy}>
              <Ic n="i-download" xs /> تنزيل ملف Excel
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span className="kpi-ic" style={{ ['--accent' as string]: 'var(--primary-600)', background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
          <Ic n="i-file" sm />
        </span>
        <div style={{ fontSize: 12.5, color: 'var(--txt-2)', lineHeight: 1.85 }}>
          {data?.autoPost ? (
            <>
              <b>الترحيل التلقائي:</b>{' '}
              {data.autoPost.enabled ? (
                <>
                  يعمل كل {data.autoPost.intervalMin} دقيقة —{' '}
                  {data.autoPost.lastRun
                    ? `آخر دورة ${new Date(data.autoPost.lastRun).toLocaleString('ar-EG')} (${data.autoPost.lastAdded ?? 0} حركة)`
                    : 'لم تُسجَّل دورة بعد'}
                  {' '}· إجمالي الدورات {data.autoPost.totalRuns}
                </>
              ) : (
                'معطّل (AUTO_POST_ENABLED=0)'
              )}
              <br />
            </>
          ) : null}
          <b>عن التصدير:</b> الملف يخرج بترتيب أعمدة شيتك نفسه (الحساب · البيان · مدين · دائن · العملة · التعادل ·
          المكافئ · مركز التكلفة · التاريخ · المبلغ · الحساب المقابل) مع ورقة باتجاه RTL، رؤوس ملوّنة
          (مدين أحمر، دائن أخضر)، تجميد الرأس، فلترة تلقائية، سطر إجماليات، وسطر تحقّق.
          <br />
          <b>الوضعان:</b> «سطر واحد» = حركة واحدة مع الحساب المقابل (يطابق شكل شيتك)، و«قيد مزدوج» = سطران لكل حركة
          فتتساوى مجاميع المدين والدائن تمامًا.
        </div>
      </div>

      {/* نافذة بديل التنزيل داخل المعاينة */}
      {csvModal !== null && (
        <div
          onClick={() => setCsvModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9,17,30,.55)',
            zIndex: 90,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: 'min(860px,100%)', maxHeight: '86vh', padding: 16, display: 'grid', gap: 10 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ fontSize: 14 }}>سطور الشيت كنص CSV</b>
              <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>
                انسخ الكل (Ctrl+A ثم Ctrl+C) والصقه في Excel — يُفتح كأعمدة مباشرة
              </span>
              <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={async () => {
                    const ta = document.getElementById('csv-ta') as HTMLTextAreaElement | null;
                    ta?.select();
                    let ok = false;
                    try {
                      await navigator.clipboard.writeText(csvModal);
                      ok = true;
                    } catch {
                      try {
                        ok = document.execCommand('copy');
                      } catch {
                        ok = false;
                      }
                    }
                    toast(ok ? 'نُسخ النص' : 'اختر النص وانسخه يدويًا (Ctrl+C)', ok ? 'ok' : 'warn');
                  }}
                >
                  <Ic n="i-file" xs /> نسخ الكل
                </button>
                <button className="btn btn-sm" onClick={() => setCsvModal(null)}>
                  <Ic n="i-x" xs /> إغلاق
                </button>
              </div>
            </div>
            <textarea
              id="csv-ta"
              readOnly
              value={csvModal}
              dir="rtl"
              style={{
                width: '100%',
                height: '52vh',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11.5,
                lineHeight: 1.7,
                borderRadius: 10,
                border: '1px solid var(--line)',
                padding: 10,
                background: 'var(--surface-2)',
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
