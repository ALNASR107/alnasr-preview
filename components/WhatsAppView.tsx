'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './WhatsAppView.module.css';

type Item = { reactions?: {text:string; fromName:string}[]; at: string; chat: string; chatName?: string; fromName?: string; text: string; fromMe?: boolean; mediaType?: string; mediaId?: string; mediaReason?: string; mediaMime?: string; fileName?: string; ok: boolean; opId?: string; messageId?: string };
type Payload = { status: string; items: Item[] };
const media: Record<string, string> = { image: 'صورة', video: 'فيديو', document: 'ملف', audio: 'رسالة صوتية', sticker: 'ملصق' };
function time(s: string) { const d = new Date(s); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }); }
function day(s: string) { const d = new Date(s); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ar-SY', { year:'numeric', month:'short', day:'numeric' }); }
function name(item: Item) { return item.chatName || item.fromName || `محادثة ${item.chat.split('@')[0]}`; }
function snippet(item: Item) { return item.text || (item.mediaType ? `[${media[item.mediaType] || 'مرفق'} — المعاينة غير متاحة]` : '[رسالة غير نصية]'); }

export default function WhatsAppView() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [visibleCount, setVisibleCount] = useState(100);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyNotice, setHistoryNotice] = useState('');
  const [mobileChat, setMobileChat] = useState(false);
  const [analysis, setAnalysis] = useState<{ text?: string; limited?: boolean; notice?: string; candidates?: { line: string }[]; error?: string } | null>(null);
  const [analyzing, setAnalyzing] = useState('');
  async function analyze(id: string) {
    setAnalyzing(id);
    try { const r = await fetch(`/api/whatsapp-image/${id}/analyse`, { method: 'POST' }); const result = await r.json(); setAnalysis(r.ok ? result : { error: result.error || 'تعذّر التحليل' }); }
    catch { setAnalysis({ error: 'تعذّر الاتصال لتحليل المرفق' }); }
    finally { setAnalyzing(''); }
  }
  async function requestHistory(chat: string) {
    setHistoryBusy(true); setHistoryNotice('');
    try { const r = await fetch('/api/whatsapp-inbox/history', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({chat}) }); const data = await r.json(); setHistoryNotice(r.ok ? data.note : data.error || 'تعذّر الطلب'); }
    catch { setHistoryNotice('تعذّر الاتصال لطلب الرسائل'); }
    finally { setHistoryBusy(false); }
  }
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp-inbox', { cache: 'no-store' });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('application/json')) throw new Error('تعذّر تحميل المحادثات، تحقّق من تسجيل الدخول');
      setData(await r.json()); setError('');
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 5000); return () => clearInterval(timer); }, [load]);
  const chats = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const item of data?.items ?? []) { if (!item.chat || item.chat === 'web@local') continue; const group = m.get(item.chat) ?? []; group.push(item); m.set(item.chat, group); }
    return Array.from(m, ([id, messages]) => ({ id, messages, latest: messages[0], name: name(messages[0]) }))
      .filter(c => `${c.name} ${c.id} ${c.messages.map(snippet).join(' ')}`.toLowerCase().includes(query.toLowerCase().trim()));
  }, [data, query]);
  const allChats = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const item of data?.items ?? []) { if (!item.chat || item.chat === 'web@local') continue; const group = m.get(item.chat) ?? []; group.push(item); m.set(item.chat, group); }
    return m;
  }, [data]);
  const currentItems = selected ? allChats.get(selected) ?? [] : [];
  const currentName = currentItems.length ? name(currentItems[0]) : '';
  const connected = data?.status === 'connected';
  return <div className={styles.page} dir="rtl">
    <header className={styles.pageHeader}><div><div className={styles.eyebrow}>شركة النصر / المحادثات</div><h1>محادثات واتساب</h1><p>اطّلع على الرسائل التي استقبلها التطبيق وحالة ترحيلها.</p></div><Link className={styles.settings} href="/settings">إعدادات الربط ←</Link></header>
    <div className={styles.notice}>للعرض فقط · لا يمكن إرسال رسائل من هنا. تظهر الرسائل التي وصلت للتطبيق فقط، وليست نسخة كاملة من واتساب. المرفقات المدعومة الجديدة تُحفظ محلياً. تحليل الصور وPDF وExcel والنصوص يدوي وللمراجعة؛ الصوت والفيديو تشغيل فقط.</div>
    {error && <div role="alert" className={styles.error}>{error} <button onClick={load}>إعادة المحاولة</button></div>}
    {analysis && <div role="dialog" aria-modal="true" aria-label="نتيجة تحليل المرفق" style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(10,25,35,.55)', display:'grid', placeItems:'center', padding:16 }}><div style={{ background:'white', color:'#173049', borderRadius:14, padding:20, width:'min(700px, 100%)', maxHeight:'85vh', overflow:'auto' }}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><h2>نتيجة التحليل المحلي</h2><button onClick={() => setAnalysis(null)} aria-label="إغلاق" style={{ fontSize:24, border:0, background:'none', cursor:'pointer' }}>×</button></div>{analysis.error ? <p role="alert">{analysis.error}</p> : <><p>{analysis.notice}</p>{analysis.limited && <p>⚠ تم تحليل جزء من الملف فقط بسبب حدود الصفحات أو الحجم.</p>}<b>النص المستخرج:</b><pre style={{ whiteSpace:'pre-wrap', overflowWrap:'anywhere', background:'#f3f6f8', padding:12, borderRadius:8, maxHeight:300, overflow:'auto' }}>{analysis.text || 'لم يتم العثور على نص قابل للقراءة.'}</pre><b>حركات محتملة بصيغة واضحة: {analysis.candidates?.length || 0}</b>{analysis.candidates?.map((c,i)=><p key={i}>{c.line}</p>)}<p>لا يتم ترحيل أي نتيجة تلقائياً.</p></>}</div></div>}
    <div className={`${styles.workspace} ${mobileChat ? styles.showChat : ''}`}>
      <aside className={styles.list}>
        <div className={styles.listHead}><div><span className={styles.tiny}>صندوق الرسائل</span><h2>المحادثات</h2></div><span className={`${styles.connection} ${connected ? styles.online : ''}`}><i />{connected ? 'متصل' : data ? 'غير متصل' : 'جارٍ التحقق'}</span></div>
        <label className={styles.search}><span aria-hidden="true">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الرسالة" aria-label="ابحث في المحادثات" /></label>
        <div className={styles.listCaption}>المحادثات المتاحة <span>{chats.length}</span></div>
        <div className={styles.chats}>
          {!data && !error && <p className={styles.emptyList}>جارٍ تحميل المحادثات…</p>}
          {data && !chats.length && <p className={styles.emptyList}>{query ? 'ما لقينا نتيجة للبحث.' : 'لا توجد رسائل مسجّلة بعد. ستظهر الرسائل الجديدة التي تصل للتطبيق هنا.'}</p>}
          {chats.map(c => <button key={c.id} onClick={() => { setSelected(c.id); setVisibleCount(100); setHistoryNotice(''); setMobileChat(true); }} className={`${styles.chatRow} ${selected === c.id ? styles.active : ''}`}>
            <span className={styles.avatar}>{c.name.trim().charAt(0) || 'و'}</span><span className={styles.chatInfo}><span className={styles.chatTitle}>{c.name}</span><span className={styles.chatSnippet}>{snippet(c.latest)}</span></span><span className={styles.chatMeta}><span>{time(c.latest.at)}</span><b>{c.messages.length}</b></span>
          </button>)}
        </div>
        <div className={styles.listFoot}>الرسائل المحفوظة محلياً · الأقدم تظهر على دفعات</div>
      </aside>
      <section className={styles.conversation} aria-label="المحادثة">
        {!selected || !currentItems.length ? <div className={styles.welcome}><div className={styles.welcomeIcon}>✉</div><h2>كل محادثاتك بمكان واحد</h2><p>اختار محادثة من القائمة لعرض الرسائل وحالة الترحيل.</p><span>عرض فقط · بدون إرسال</span></div> : <>
          <div className={styles.conversationHead}><button className={styles.back} onClick={() => setMobileChat(false)} aria-label="العودة إلى المحادثات">→</button><span className={styles.avatar}>{currentName.trim().charAt(0)}</span><div><h2>{currentName}</h2><p>{selected.endsWith('@g.us') ? 'مجموعة' : 'محادثة'} · الرسائل المسجّلة في التطبيق</p></div><Link href="/sheet" className={styles.sheetLink}>شيت الترحيل ↗</Link></div>
          <div style={{padding:'8px 14px',fontSize:12,background:'#eef6f3'}}><button className={styles.settings} disabled={historyBusy || !connected} onClick={()=>requestHistory(selected)} style={{cursor:'pointer'}}>{historyBusy ? 'جارٍ الطلب…' : 'طلب رسائل أقدم من واتساب'}</button> <span>{historyNotice || 'كل طلب حتى ٥٠ رسالة؛ قد لا يرسل واتساب السجل كاملاً.'}</span></div>
          <div className={styles.messages}>{currentItems.length > visibleCount && <button className={styles.settings} style={{ alignSelf: 'center', cursor: 'pointer' }} onClick={() => setVisibleCount(n => n + 100)}>عرض رسائل أقدم ({currentItems.length - visibleCount})</button>}{[...currentItems.slice(0, visibleCount)].reverse().map((item, index) => <div key={`${item.messageId || item.at}-${index}`} className={`${styles.messageWrap} ${item.fromMe === true ? styles.mine : ''}`}>
            <div className={styles.bubble}>{item.fromMe === true ? <strong>أنت</strong> : item.fromName && selected.endsWith('@g.us') ? <strong>{item.fromName}</strong> : null}{item.mediaId && (item.mediaType === 'image' || item.mediaType === 'sticker') && <a href={`/api/whatsapp-image/${item.mediaId}`} target="_blank" rel="noreferrer"><img src={`/api/whatsapp-image/${item.mediaId}`} alt="صورة من المحادثة" loading="lazy" style={{ display: 'block', maxWidth: '100%', maxHeight: 320, borderRadius: 10, marginBottom: 8, objectFit: 'contain' }} /></a>}{item.mediaId && item.mediaType === 'audio' && <audio controls preload="none" src={`/api/whatsapp-image/${item.mediaId}`} style={{ maxWidth: '100%' }} />}{item.mediaId && item.mediaType === 'video' && <video controls preload="none" src={`/api/whatsapp-image/${item.mediaId}`} style={{ maxWidth: '100%', maxHeight: 320 }} />}{item.mediaId && item.mediaType === 'document' && <a className={styles.settings} href={`/api/whatsapp-image/${item.mediaId}`} target="_blank" rel="noreferrer" style={{ display:'inline-block', marginBottom:8 }}>📄 {item.fileName || 'فتح الملف'}</a>}{item.mediaId && ['jpg','png','webp','pdf','xlsx','txt'].includes(item.mediaMime || '') && <button className={styles.settings} style={{ display:'block', margin:'8px 0', cursor:'pointer' }} disabled={Boolean(analyzing)} onClick={() => analyze(item.mediaId!)}>{analyzing === item.mediaId ? 'جارٍ التحليل محلياً…' : 'تحليل المرفق محلياً'}</button>}{item.text ? <div className={styles.text}>{item.text.startsWith('[تفاعل]') ? item.text.replace('[تفاعل]', '[تفاعل قديم، الرسالة الأصلية غير معروفة]') : item.text}</div> : !item.mediaId && <div className={styles.text}>{snippet(item)}</div>}{item.mediaType && item.text && !item.mediaId && <div className={styles.attachment}>مرفق {media[item.mediaType] || 'ملف'} · المعاينة غير متاحة</div>}{item.mediaReason && <div className={styles.attachment}>{item.mediaReason}</div>}{Boolean(item.reactions?.length) && <div aria-label="تفاعلات الرسالة" style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>{item.reactions?.map((r,i)=><span key={i} title={r.fromName || 'تفاعل'} style={{ background:'#edf6f1', borderRadius:14, padding:'2px 7px', fontSize:14 }}>{r.text}</span>)}</div>}<div className={styles.messageMeta}><span>{day(item.at)} · {time(item.at)}</span><span className={item.ok ? styles.posted : styles.notPosted}>{item.ok ? '✓ مرحّلة' : 'لم تُرحّل'}</span></div></div>
          </div>)}</div>
          <div className={styles.readonly}><span>🔒</span><div><b>وضع العرض فقط</b><small>إرسال الرسائل معطّل بناءً على طلبك</small></div></div>
        </>}
      </section>
    </div>
  </div>;
}
