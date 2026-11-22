'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from './Toaster';
type Mode = 'text' | 'images' | 'off';
type CurrencyMode = 'original' | 'usd';
type Result = { at: string; chatName: string; status: 'posted' | 'review' | 'unclear' | 'error'; text: string; opId?: string; reason?: string };
type Data = { connected: boolean; groups: { jid: string; name: string }[]; rules: Record<string, Mode>; currencyRules: Record<string, CurrencyMode>; rates: { chat: string; currency: string; rate: number; at: string }[]; ocr: { ready: boolean }; results: Result[] };
export default function GroupRules() {
  const [data, setData] = useState<Data | null>(null); const [query, setQuery] = useState(''); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const toast = useToast();
  const load = useCallback(async () => { try { const r = await fetch('/api/whatsapp-group-rules', { cache: 'no-store' }); if (!r.ok) throw new Error('تعذّر تحميل إعدادات المجموعات'); setData(await r.json()); setError(''); } catch (e) { setError((e as Error).message); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function change(jid: string, mode: Mode) {
    setBusy(jid);
    try { const r = await fetch('/api/whatsapp-group-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid, mode }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'تعذّر الحفظ'); const verify = await fetch('/api/whatsapp-group-rules', { cache: 'no-store' }); const latest = await verify.json(); if (!verify.ok || latest.rules?.[jid] !== mode) throw new Error('ما تأكد حفظ الإعداد، جرّب مرة تانية'); setData(current => current ? { ...current, rules: { ...current.rules, [jid]: mode } } : current); toast('تم حفظ إعداد المجموعة', 'ok'); }
    catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(''); }
  }
  async function changeCurrency(jid: string, currencyMode: CurrencyMode) {
    setBusy(jid);
    try {
      const r = await fetch('/api/whatsapp-group-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jid, currencyMode }) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error || 'تعذّر الحفظ');
      const verify = await fetch('/api/whatsapp-group-rules', { cache: 'no-store' }); const latest = await verify.json();
      if (!verify.ok || latest.currencyRules?.[jid] !== currencyMode) throw new Error('ما تأكد حفظ الإعداد');
      setData(current => current ? { ...current, currencyRules: { ...current.currencyRules, [jid]: currencyMode } } : current); toast('تم حفظ عملة الترحيل', 'ok');
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(''); }
  }
  const groups = (data?.groups ?? []).filter(g => `${g.name} ${g.jid}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="card panel" style={{ marginTop: 14 }}>
    <div className="panel-head"><div><h3>نوع الترحيل لكل مجموعة</h3><div className="sub">اختار إذا المجموعة بتعالج نصوص أو صور فقط. الإعداد بيُطبّق على الرسائل الجديدة.</div></div><div className="tools"><button className="btn btn-sm" onClick={load}>تحديث المجموعات</button></div></div>
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)', fontSize: 12.5, lineHeight: 1.8 }}>
        النصوص: فقط الرسائل بصيغة مالية واضحة. الصور: قراءة محلية على هذا الجهاز. إيصال المحفظة أو إشعار التحويل الناجح يُرحّل تلقائياً عند تطابق القراءتين ووضوح المبلغ والعملة ورقم العميل والمرسل، والمرجع إذا كان إيصال محفظة؛ الصور الأخرى للمراجعة. المرفقات الأخرى وPDF غير مدعومة هنا. لم يتم إرسال رسائل للواتساب.
      </div>
      <div style={{ fontSize: 12, color: data?.ocr.ready ? 'var(--in)' : 'var(--out)' }}>{data?.ocr.ready ? '✓ قراءة الصور المحلية متاحة بالعربي والإنكليزي' : '⚠ قراءة الصور غير جاهزة على هذا الجهاز: ثبّت Tesseract مع لغتي ara و eng. لن تُرحّل الصور قبل ذلك.'}</div>
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)', fontSize: 12, lineHeight: 1.8 }}>
        <b>نشرة القص:</b> تُقرأ النشرة مثل «فودافون 55.03 بدون أجور» أو «سعر قص الجنيه 50.2»؛ سعر فودافون المعيّن ينطبق على كل حركات الجنيه في نفس المجموعة. الحركات التالية تستخدم آخر سعر سابق لنفس المجموعة والعملة. اختر لكل مجموعة الترحيل بعملة الرسالة أو بالدولار بعد القص؛ المبلغ الأصلي يبقى في نص البيان. السعر يُقرأ من أي عضو بالمجموعة؛ تأكد من مصدر النشرة. لا يُعدّل الحركات السابقة، وإذا اخترت الدولار ولم يوجد سعر سابق تُترك الحركة للمراجعة.
      </div>
      {data?.rates.length ? <div style={{ maxHeight: 130, overflow: 'auto', fontSize: 12, color: 'var(--txt-2)' }}>{data.rates.map(r => <div key={`${r.chat}-${r.currency}`} style={{ padding: '3px 0' }}>{data.groups.find(g => g.jid === r.chat)?.name || r.chat} · {r.currency} · القص {r.rate} · {new Date(r.at).toLocaleString('ar-SY')}</div>)}</div> : <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>لا توجد نشرات قص مسجّلة بعد.</div>}
      {error && <div role="alert" style={{ color: 'var(--out)' }}>{error}</div>}
      {!data ? <div>جارٍ تحميل الإعدادات…</div> : !data.connected ? <div>اربط واتساب أولاً لتظهر المجموعات.</div> : <>
        <input aria-label="بحث عن مجموعة" value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن مجموعة..." style={{ maxWidth: 400, width: '100%', padding: 10, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--txt)' }} />
        <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
          {!groups.length && <div style={{ padding: 14, fontSize: 13 }}>لا توجد مجموعات مطابقة.</div>}
          {groups.map(group => <div key={group.jid} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap', borderBottom: '1px solid var(--line)' }}><div><b>{group.name}</b><div dir="ltr" style={{ textAlign: 'right', fontSize: 10, color: 'var(--txt-3)' }}>{group.jid}</div></div><label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>النوع <select aria-label={`نوع ترحيل ${group.name}`} disabled={busy === group.jid} value={data.rules[group.jid] ?? 'text'} onChange={e => change(group.jid, e.target.value as Mode)} style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--txt)' }}><option value="text">رسائل نصية فقط</option><option value="images">صور فقط</option><option value="off">إيقاف الترحيل</option></select></label><label style={{ display:'flex', gap:6, alignItems:'center', fontSize:12 }}>عملة الترحيل <select aria-label={`عملة ترحيل ${group.name}`} disabled={busy === group.jid} value={data.currencyRules?.[group.jid] ?? 'original'} onChange={e => changeCurrency(group.jid, e.target.value as CurrencyMode)} style={{ padding:'7px 10px', border:'1px solid var(--line)', borderRadius:8, background:'var(--surface)', color:'var(--txt)' }}><option value="original">عملة الرسالة الأصلية</option><option value="usd">دولار بعد القص</option></select></label></div>)}
        </div>
      </>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><b>آخر نتائج قراءة الصور</b><Link href="/operations" className="btn btn-sm">فتح سجل العمليات للمراجعة</Link></div>
      {data?.results.length ? <div style={{ maxHeight: 300, overflow: 'auto', display: 'grid', gap: 8 }}>{data.results.map((x,i) => <div key={`${x.at}-${i}`} style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 9, fontSize: 12, lineHeight: 1.7 }}><b>{x.chatName}</b> · {x.status === 'posted' ? `حركة ${x.opId} مرحّلة تلقائياً` : x.status === 'review' ? `حركة ${x.opId} للمراجعة` : x.status === 'unclear' ? 'صورة غير واضحة — لم تُرحّل' : 'تعذّرت القراءة'}<div>{x.reason}</div>{x.text && <div style={{ whiteSpace: 'pre-wrap', marginTop: 5 }}>{x.text}</div>}</div>)}</div> : <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>لا توجد نتائج صور بعد.</div>}
    </div>
  </div>;
}
