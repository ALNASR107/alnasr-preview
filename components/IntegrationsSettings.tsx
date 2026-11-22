'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ic } from './Icons';
import { useToast } from './Toaster';
import GroupRules from './GroupRules';

type Event = { at: string; ch: 'whatsapp' | 'wakeed'; ok: boolean; msg: string };

export type IntegrationsStatus = {
  whatsapp: { configured: boolean; phoneNumberId?: string | null; notifyTo?: string | null };
  wakeed: { configured: boolean; baseUrl?: string | null };
  events: Event[];
};

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="chip"
      style={{ height: 24, fontSize: 11, padding: '0 8px' }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* ignore */
        }
      }}
    >
      <i style={{ background: done ? 'var(--in)' : 'var(--ink-400)' }} />
      {done ? 'تم النسخ' : 'نسخ'}
    </button>
  );
}

function Code({ children }: { children: string }) {
  return (
    <div
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11.5,
        direction: 'ltr',
        textAlign: 'left',
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 9,
        padding: '8px 10px',
        color: 'var(--txt-2)',
        overflowX: 'auto',
        whiteSpace: 'pre',
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ on }: { on: boolean }) {
  return (
    <span className={`badge ${on ? 'posted' : 'pending'}`}>
      <i />
      {on ? 'مهيّأ ومتصل' : 'غير مهيّأ — وضع تجريبي'}
    </span>
  );
}

type WaState = {
  status: 'idle' | 'starting' | 'qr' | 'pairing' | 'connected' | 'closed' | 'error';
  qr: string | null;
  pairingCode?: string | null;
  pairingCodePretty?: string | null;
  pairingPhone?: string | null;
  me: string | null;
  error: string | null;
  startedAt?: number | null;
};

type InboxItem = { at: string; fromName: string; text: string; ok: boolean; opId?: string; amount?: number; reason?: string };
type RawEvent = { at: string; chat: string; fromMe: boolean; text: string; action: string };

export default function IntegrationsSettings({ initial }: { initial: IntegrationsStatus }) {
  const toast = useToast();
  const [status, setStatus] = useState(initial);
  const [origin, setOrigin] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('رسالة اختبار من شركة النصر ✅');
  const [busy, setBusy] = useState<'wa' | 'wk' | null>(null);
  const [wa, setWa] = useState<WaState>({ status: 'idle', qr: null, me: null, error: null });
  const [waBusy, setWaBusy] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waMsg, setWaMsg] = useState('مرحبًا من شركة النصر — رسالة عبر الجهاز المرتبط ✅');
  const [pairPhone, setPairPhone] = useState('');
  const [pairBusy, setPairBusy] = useState(false);
  const [inbox, setInbox] = useState<{ items: InboxItem[]; stats: { total: number; accepted: number; rejected: number; amount: number } } | null>(null);
  const [groups, setGroups] = useState<{ jid: string; name: string; size: number }[]>([]);
  const [raw, setRaw] = useState<RawEvent[]>([]);
  const [selfTest, setSelfTest] = useState<{ at: string; ok: boolean; msg: string } | null>(null);
  const [sheetTarget, setSheetTarget] = useState('');
  const [sheetBusy, setSheetBusy] = useState(false);
  const [testText, setTestText] = useState('تحويل 750000 من شركة النور بنك');

  useEffect(() => setOrigin(window.location.origin), []);

  // استطلاع حالة ربط الجهاز كل 2.5 ثانية (لتحديث QR تلقائيًا)
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch('/api/integrations/whatsapp/web/status', { cache: 'no-store' });
        if (r.ok && alive) setWa((await r.json()) as WaState);
      } catch {
        /* ignore */
      }
    };
    tick();
    const iv = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/integrations/status', { cache: 'no-store' });
    if (r.ok) setStatus(await r.json());
  }, []);

  async function testWhatsApp() {
    if (!phone.trim()) {
      toast('أدخل رقم الهاتف أولًا', 'warn');
      return;
    }
    setBusy('wa');
    try {
      const r = await fetch('/api/integrations/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, text: msg }),
      });
      const data = await r.json();
      toast(data.ok ? data.message ?? 'أُرسلت الرسالة' : data.error ?? 'فشل الإرسال', data.ok ? 'ok' : 'err');
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function syncWakeed() {
    setBusy('wk');
    try {
      const list = await fetch('/api/operations?perPage=1', { cache: 'no-store' }).then((r) => r.json());
      const op = list?.rows?.[0];
      if (!op) {
        toast('لا توجد عمليات للمزامنة', 'warn');
        return;
      }
      const r = await fetch('/api/integrations/wakeed/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: op.id }),
      });
      const data = await r.json();
      toast(
        data.ok ? (data.simulated ? data.message : `تم دفع ${op.id} إلى وكيد`) : data.error ?? 'فشل الدفع',
        data.ok ? 'ok' : 'err',
      );
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  // رسائل واتساب الواردة + المجموعات (المجموعات تحتاج ربطًا فعليًا)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/integrations/whatsapp/inbox', { cache: 'no-store' });
        if (r.ok && alive) setInbox(await r.json());
        const d = await fetch('/api/integrations/whatsapp/web/diagnostics', { cache: 'no-store' });
        if (d.ok && alive) setRaw(((await d.json()) as { recent?: RawEvent[] }).recent ?? []);
      } catch {
        /* ignore */
      }
    };
    void load();
    const t = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (wa.status !== 'connected') return;
    fetch('/api/integrations/whatsapp/web/groups', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => setGroups([]));
  }, [wa.status]);

  /** ربط برمز الاقتران (بدل مسح QR) */
  async function connectByCode() {
    const digits = pairPhone.replace(/\D/g, '');
    if (digits.length < 8) {
      toast('أدخل الرقم بصيغة دولية بدون + (مثال: 9639xxxxxxxx)', 'warn');
      return;
    }
    setPairBusy(true);
    try {
      const r = await fetch('/api/integrations/whatsapp/web/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });
      const data = (await r.json()) as WaState;
      setWa(data);
      toast('سيظهر رمز الاقتران خلال لحظات — أدخله في واتساب', 'info');
    } finally {
      setPairBusy(false);
    }
  }

  /** فحص الاستقبال: يرسل حركة تجريبية إلى محادثة نفسك ويعرض النتيجة */
  async function runSelfTest() {
    setSheetBusy(true);
    try {
      const r = await fetch('/api/integrations/whatsapp/web/selftest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000 }),
      });
      const d = await r.json();
      const ev = d.event as RawEvent | null;
      setSelfTest({
        at: new Date().toLocaleTimeString('ar-EG'),
        ok: Boolean(d.ok),
        msg: d.ok
          ? `وصلت الرسالة ونتيجة المعالجة: ${ev?.action ?? 'تمّت'}`
          : (d.error as string) ?? 'لم تصل الرسالة — راجع الحالة أعلاه',
      });
      toast(d.ok ? 'الاستقبال يعمل ✅' : d.error ?? 'لم تصل الرسالة', d.ok ? 'ok' : 'err');
      const rr = await fetch('/api/integrations/whatsapp/inbox', { cache: 'no-store' });
      if (rr.ok) setInbox(await rr.json());
    } finally {
      setSheetBusy(false);
    }
  }

  /** إرسال الشيت كاملًا إلى رقم/مجموعة */
  async function sendSheetToWa() {
    if (!sheetTarget.trim()) {
      toast('اختر مجموعة أو أدخل رقمًا', 'warn');
      return;
    }
    setSheetBusy(true);
    try {
      const r = await fetch('/api/integrations/whatsapp/web/send-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: sheetTarget, limit: 30 }),
      });
      const d = await r.json();
      toast(d.ok ? 'أُرسل الشيت إلى واتساب' : d.error ?? 'فشل الإرسال', d.ok ? 'ok' : 'err');
    } finally {
      setSheetBusy(false);
    }
  }

  /** تجربة تحويل نص إلى حركة (نفس مسار رسائل واتساب) */
  async function testIngest(text?: string) {
    const t = (text ?? testText).trim();
    if (!t) return;
    setSheetBusy(true);
    try {
      const r = await fetch('/api/integrations/whatsapp/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      const d = await r.json();
      toast(
        d.ok ? `أُنشئت الحركة ${d.operation?.id} ورُحّلت إلى الشيت (${Number(d.operation?.amount ?? 0).toLocaleString('en-US')})` : d.error ?? 'لم أفهم المبلغ',
        d.ok ? 'ok' : 'err',
      );
      const rr = await fetch('/api/integrations/whatsapp/inbox', { cache: 'no-store' });
      if (rr.ok) setInbox(await rr.json());
    } finally {
      setSheetBusy(false);
    }
  }

  async function connectDevice() {
    setWaBusy(true);
    try {
      const r = await fetch('/api/integrations/whatsapp/web/connect', { method: 'POST' });
      const data = (await r.json()) as WaState;
      setWa(data);
      toast(
        data.status === 'qr' ? 'امسح رمز QR من واتساب' : data.error ?? 'جارٍ تجهيز الجلسة…',
        data.status === 'qr' ? 'ok' : 'info',
      );
    } finally {
      setWaBusy(false);
    }
  }

  async function logoutDevice() {
    setWaBusy(true);
    try {
      const r = await fetch('/api/integrations/whatsapp/web/logout', { method: 'POST' });
      setWa((await r.json()) as WaState);
      toast('تم فصل الجهاز', 'warn');
      await refresh();
    } finally {
      setWaBusy(false);
    }
  }

  async function sendViaDevice() {
    if (!waPhone.trim()) {
      toast('أدخل رقم المستلم', 'warn');
      return;
    }
    setWaBusy(true);
    try {
      const r = await fetch('/api/integrations/whatsapp/web/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: waPhone, text: waMsg }),
      });
      const data = await r.json();
      toast(data.ok ? 'أُرسلت الرسالة من رقمك المرتبط' : data.error ?? 'فشل الإرسال', data.ok ? 'ok' : 'err');
      await refresh();
    } finally {
      setWaBusy(false);
    }
  }

  const envWA = [
    'WHATSAPP_TOKEN=EAAG...',
    'WHATSAPP_PHONE_NUMBER_ID=1234567890',
    'WHATSAPP_VERIFY_TOKEN=amanah-verify-token',
    'WHATSAPP_APP_SECRET=...',
    'WHATSAPP_NOTIFY_TO=9639xxxxxxxx',
  ].join('\n');

  const envWK = [
    'WAKEED_BASE_URL=https://api.wakeed.online/v1',
    'WAKEED_API_KEY=...',
    'WAKEED_WEBHOOK_SECRET=...',
  ].join('\n');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>الإعدادات والتكاملات</h1>
          <p>ربط المنصّة بـ <b>واتساب</b> للإشعارات وأوامر الاعتماد، وبـ <b>وكيد</b> للمحاسبة والفواتير.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={refresh}>
            <Ic n="i-refresh" sm /> تحديث الحالة
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 14 }}>
        {/* ================= واتساب ================= */}
        <div className="card panel">
          <div className="panel-head">
            <div className="kpi-ic" style={{ ['--accent' as string]: 'var(--in)', background: 'var(--in-bg)', color: 'var(--in)' }}>
              <Ic n="i-bell" sm />
            </div>
            <div>
              <h3>واتساب (WhatsApp Cloud API)</h3>
              <div className="sub">إشعارات فورية + أوامر اعتماد من الجوال</div>
            </div>
            <div className="tools"><StatusBadge on={status.whatsapp.configured} /></div>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>ما يعمل بعد الربط</div>
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, color: 'var(--txt-2)', lineHeight: 1.9 }}>
                <li>إشعار العميل عند ترحيل عمليته (قالب معتمد).</li>
                <li>رسالة للمحاسب بكل عملية تحتاج اعتمادًا.</li>
                <li>الردّ بـ <b>«اعتماد OP-24599»</b> أو <b>«رفض OP-24599»</b> يغيّر حالة العملية فورًا.</li>
              </ul>
            </div>

            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>متغيّرات البيئة</div>
              <Code>{envWA}</Code>
            </div>

            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>عنوان الويبهوك (ضعه في لوحة ميتا)</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Code>{`${origin || 'https://your-domain.com'}/api/webhooks/whatsapp`}</Code>
                <Copy value={`${origin}/api/webhooks/whatsapp`} />
              </div>
              <div className="kpi-label" style={{ marginTop: 6, fontWeight: 500, color: 'var(--txt-3)' }}>
                في Meta for Developers: WhatsApp → Configuration → Webhook، أدخل العنوان و<b>Verify Token</b>، ثم اشترك في حقل <b>messages</b>.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
              <div className="kpi-label">إرسال رسالة اختبار</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field slim" style={{ flex: 1 }}>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9639xxxxxxxx"
                    dir="ltr"
                    style={{ minWidth: 0, width: '100%', paddingTop: 0 }}
                  />
                </div>
                <button className="btn btn-primary" onClick={testWhatsApp} disabled={busy === 'wa'}>
                  <Ic n="i-in" sm /> {busy === 'wa' ? 'جارٍ الإرسال…' : 'إرسال'}
                </button>
              </div>
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                className="chip"
                style={{ height: 36, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', padding: '0 10px', fontSize: 12.5, width: '100%', fontWeight: 500 }}
              />
            </div>
          </div>
        </div>

        {/* ================= وكيد ================= */}
        <div className="card panel">
          <div className="panel-head">
            <div className="kpi-ic" style={{ ['--accent' as string]: 'var(--primary-600)', background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
              <Ic n="i-file" sm />
            </div>
            <div>
              <h3>وكيد (API + Webhook)</h3>
              <div className="sub">فاتورة/قيد محاسبي لكل عملية مرحّلة</div>
            </div>
            <div className="tools"><StatusBadge on={status.wakeed.configured} /></div>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>كيف تحصل على بيانات الربط</div>
              <ol style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, color: 'var(--txt-2)', lineHeight: 1.9 }}>
                <li>تواصل مع وكيد واطلب تفعيل <b>API &amp; Webhook</b> لحسابك (منشور في ميزاتهم).</li>
                <li>ستستلم: <b>Base URL</b>، <b>API Key</b>، ومسارات الفواتير/القيود، و<b>Webhook Secret</b>.</li>
                <li>ضعها في <code>.env.local</code> ثم أعد التشغيل — لا يحتاج الكود أي تعديل.</li>
                <li>اختلفت أسماء الحقول؟ عدّل فقط <code>mapOperationToWakeedInvoice</code> في <code>lib/integrations/wakeed.ts</code>.</li>
              </ol>
            </div>

            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>متغيّرات البيئة</div>
              <Code>{envWK}</Code>
            </div>

            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>عنوان ويبهوك وكيد (لتحديث حالة الفواتير)</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Code>{`${origin || 'https://your-domain.com'}/api/webhooks/wakeed`}</Code>
                <Copy value={`${origin}/api/webhooks/wakeed`} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12, display: 'grid', gap: 8 }}>
              <div className="kpi-label">دفع أحدث عملية إلى وكيد الآن</div>
              <button className="btn btn-primary" onClick={syncWakeed} disabled={busy === 'wk'}>
                <Ic n="i-out" sm /> {busy === 'wk' ? 'جارٍ الدفع…' : 'مزامنة عملية تجريبية'}
              </button>
              <div className="kpi-label" style={{ fontWeight: 500, color: 'var(--txt-3)' }}>
                في الوضع التجريبي (بلا مفاتيح) يُجهَّز الكائن ويُسجَّل الحدث دون إرسال فعلي.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ربط الجهاز (QR) ================= */}
      <div className="card panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <div
            className="kpi-ic"
            style={{ ['--accent' as string]: 'var(--rev)', background: 'var(--rev-bg)', color: 'var(--rev)' }}
          >
            <Ic n="i-card" sm />
          </div>
          <div>
            <h3>ربط جهاز واتساب (QR) — بدون API رسمي</h3>
            <div className="sub">اربط رقمك كما تربط واتساب ويب: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز</div>
          </div>
          <div className="tools">
            <span
              className={`badge ${
                wa.status === 'connected' ? 'posted' : wa.status === 'qr' ? 'pending' : wa.status === 'error' ? 'failed' : 'ignored'
              }`}
            >
              <i />
              {wa.status === 'connected'
                ? 'مرتبط'
                : wa.status === 'pairing'
                ? 'بانتظار رمز الاقتران'
                : wa.status === 'qr'
                ? 'بانتظار المسح'
                : wa.status === 'starting'
                ? 'جارٍ التجهيز…'
                : wa.status === 'error'
                ? 'خطأ'
                : 'غير مرتبط'}
            </span>
          </div>
        </div>

        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'start' }}>
          {/* رمز QR */}
          <div
            style={{
              width: 224,
              minHeight: 224,
              borderRadius: 14,
              border: '1px dashed var(--line)',
              background: 'var(--surface-2)',
              display: 'grid',
              placeItems: 'center',
              padding: 10,
            }}
          >
            {wa.status === 'connected' ? (
              <div style={{ textAlign: 'center', color: 'var(--in)' }}>
                <div className="kpi-ic" style={{ margin: '0 auto 8px', background: 'var(--in-bg)', color: 'var(--in)' }}>
                  <Ic n="i-check" />
                </div>
                <b style={{ fontSize: 13 }}>الجهاز مرتبط</b>
                <div className="num" style={{ fontSize: 12, color: 'var(--txt-3)', marginTop: 3 }}>
                  {wa.me ? `+${wa.me}` : ''}
                </div>
              </div>
            ) : wa.pairingCodePretty ? (
              <div style={{ textAlign: 'center' }}>
                <div className="kpi-label" style={{ marginBottom: 6 }}>رمز الاقتران</div>
                <div
                  dir="ltr"
                  className="num"
                  style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, color: 'var(--primary-700)' }}
                >
                  {wa.pairingCodePretty}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 8, lineHeight: 1.7 }}>
                  أدخله في واتساب ← الأجهزة المرتبطة
                </div>
              </div>
            ) : wa.qr ? (
              <img src={wa.qr} alt="رمز QR لربط واتساب" width={200} height={200} style={{ background: '#fff', borderRadius: 8, padding: 6 }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--txt-3)', fontSize: 12, padding: 10 }}>
                <Ic n="i-refresh" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                {wa.status === 'starting' ? 'جارٍ طلب رمز QR…' : 'اضغط «بدء الربط» لإظهار الرمز'}
              </div>
            )}
          </div>

          {/* الخطوات والأزرار */}
          <div style={{ display: 'grid', gap: 12 }}>
            <ol style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, color: 'var(--txt-2)', lineHeight: 1.9 }}>
              <li>اضغط <b>بدء الربط</b> — سيظهر رمز QR هنا خلال ثوانٍ.</li>
              <li>من جوالك: واتساب ← <b>الإعدادات</b> ← <b>الأجهزة المرتبطة</b> ← <b>ربط جهاز</b>.</li>
              <li>امسح الرمز — أو استخدم <b>رمز الاقتران</b> أدناه بدلًا من المسح.</li>
            </ol>

            {/* الربط برمز الاقتران */}
            <div
              style={{
                border: '1px dashed var(--line)',
                borderRadius: 12,
                padding: 12,
                display: 'grid',
                gap: 8,
                background: 'var(--surface-2)',
              }}
            >
              <div className="kpi-label" style={{ fontWeight: 600, color: 'var(--txt-2)' }}>
                الربط برمز الاقتران (بدل مسح QR)
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="field slim" style={{ flex: '1 1 180px' }}>
                  <input
                    value={pairPhone}
                    onChange={(e) => setPairPhone(e.target.value)}
                    placeholder="9639xxxxxxxx"
                    dir="ltr"
                    inputMode="numeric"
                    style={{ minWidth: 0, width: '100%', paddingTop: 0 }}
                  />
                </div>
                <button className="btn btn-primary" onClick={connectByCode} disabled={pairBusy || wa.status === 'connected'}>
                  <Ic n="i-lock" sm /> {pairBusy ? 'جارٍ…' : 'ربط برمز'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt-3)', lineHeight: 1.8 }}>
                الرقم بصيغة دولية بدون «+». بعد الضغط: واتساب ← <b>الإعدادات</b> ← <b>الأجهزة المرتبطة</b> ←
                <b> ربط جهاز</b> ← <b>«الربط برقم الهاتف بدلًا من ذلك»</b> ← أدخل الرمز الظاهر هنا.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={connectDevice} disabled={waBusy || wa.status === 'connected'}>
                <Ic n="i-plus" sm /> {waBusy ? 'جارٍ…' : wa.status === 'qr' ? 'تحديث الرمز' : 'بدء الربط'}
              </button>
              <button className="btn" onClick={logoutDevice} disabled={waBusy || wa.status === 'idle'}>
                <Ic n="i-x" sm /> فصل الجهاز
              </button>
              <span className="kpi-label" style={{ alignSelf: 'center', fontWeight: 500 }}>
                الجلسة تُحفظ في <b>.wa-auth</b> على الخادم
              </span>
            </div>

            {wa.error && <div className="err-text">{wa.error}</div>}

            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12, display: 'grid', gap: 8 }}>
              <div className="kpi-label">إرسال رسالة من الرقم المرتبط</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="field slim" style={{ flex: '1 1 180px' }}>
                  <input
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="9639xxxxxxxx"
                    dir="ltr"
                    style={{ minWidth: 0, width: '100%', paddingTop: 0 }}
                  />
                </div>
                <div className="field slim" style={{ flex: '2 1 240px' }}>
                  <input
                    value={waMsg}
                    onChange={(e) => setWaMsg(e.target.value)}
                    style={{ minWidth: 0, width: '100%', paddingTop: 0 }}
                  />
                </div>
                <button className="btn" onClick={sendViaDevice} disabled={waBusy || wa.status !== 'connected'}>
                  <Ic n="i-in" sm /> إرسال
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 9,
                alignItems: 'flex-start',
                background: 'var(--wait-bg)',
                border: '1px solid var(--wait-line)',
                borderRadius: 11,
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--txt-2)',
                lineHeight: 1.8,
              }}
            >
              <Ic n="i-alert" sm style={{ color: 'var(--wait)', marginTop: 2 }} />
              <div>
                <b>تنبيه:</b> هذا الربط غير رسمي (يعتمد على بروتوكول واتساب ويب) ويخالف شروط خدمة واتساب — قد
                يُحظر الرقم. للإشعارات الرسمية للعملاء استخدم <b>Cloud API</b> أعلاه؛ واستخدم «الأجهزة المرتبطة»
                لرقم داخلي/تشغيلي فقط، وبعدد رسائل معقول.
              </div>
            </div>
          </div>
        </div>
      </div>

      <GroupRules />

      {/* ================= حركات واتساب → الشيت ================= */}
      <div className="card panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <div className="kpi-ic" style={{ ['--accent' as string]: 'var(--in)', background: 'var(--in-bg)', color: 'var(--in)' }}>
            <Ic n="i-in" sm />
          </div>
          <div>
            <h3>حركات واتساب → شيت الموقع</h3>
            <div className="sub">
              النصوص الواضحة فقط تُرحّل وفق إعداد كل مجموعة؛ الصور تُراجع قبل الترحيل
            </div>
          </div>
          <div className="tools">
            <span className={`badge ${wa.status === 'connected' ? 'posted' : 'pending'}`}>
              <i />
              {wa.status === 'connected' ? 'الاستقبال يعمل' : 'يتطلّب ربط الجهاز'}
            </span>
          </div>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {[
              { label: 'رسائل واردة', value: inbox?.stats.total ?? 0 },
              { label: 'صارت حركات', value: inbox?.stats.accepted ?? 0 },
              { label: 'غير مفهومة', value: inbox?.stats.rejected ?? 0 },
              { label: 'إجمالي المبالغ', value: Number(inbox?.stats.amount ?? 0).toLocaleString('en-US') },
            ].map((k) => (
              <div key={k.label} style={{ border: '1px solid var(--line-soft)', borderRadius: 11, padding: '10px 12px' }}>
                <div className="kpi-label">{k.label}</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--txt-2)', lineHeight: 1.9, background: 'var(--surface-2)', borderRadius: 11, padding: '10px 12px' }}>
            <b>أمثلة تُفهم تلقائيًا:</b>
            <div dir="rtl" style={{ marginTop: 4 }}>
              «تم قبض 500 دولار من أحمد» · «تم دفع 1500 ليرة سورية إلى خالد»
            </div>
            <div style={{ marginTop: 6, color: 'var(--txt-3)' }}>
              أرسل من رقم آخر إلى الرقم المرتبط، أو من الرقم المرتبط نفسه إلى <b>محادثة نفسك</b>، أو إلى
              مجموعة. المتغيّرات: <b>WA_INGEST_ENABLED=0</b> إيقاف الاستقبال · <b>WA_INGEST_GROUPS=0</b>
              تجاهل المجموعات · <b>WA_INGEST_FROM_ME=0</b> تجاهل الرسائل الصادرة.
            </div>
          </div>

          {/* تجربة سريعة */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="field slim" style={{ flex: '1 1 260px' }}>
              <input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="تحويل 500000 من شركة النور بنك"
                style={{ minWidth: 0, width: '100%', paddingTop: 0 }}
              />
            </div>
            <button className="btn" onClick={() => testIngest()} disabled={sheetBusy}>
              <Ic n="i-plus" sm /> تجربة: حوّل النص إلى حركة
            </button>
          </div>

          {/* إرسال الشيت إلى واتساب */}
          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12, display: 'grid', gap: 8 }}>
            <div className="kpi-label" style={{ fontWeight: 600, color: 'var(--txt-2)' }}>
              إرسال الشيت (كل الحركات المجمّعة) إلى واتساب
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {groups.length > 0 ? (
                <div className="field slim" style={{ flex: '1 1 240px' }}>
                  <select
                    value={sheetTarget}
                    onChange={(e) => setSheetTarget(e.target.value)}
                    style={{ minWidth: 0, width: '100%', paddingTop: 0 }}
                  >
                    <option value="">— اختر مجموعة —</option>
                    {groups.map((g) => (
                      <option key={g.jid} value={g.jid}>
                        {g.name} ({g.size})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="field slim" style={{ flex: '1 1 240px' }}>
                  <input
                    value={sheetTarget}
                    onChange={(e) => setSheetTarget(e.target.value)}
                    placeholder="9639xxxxxxxx أو JID مجموعة"
                    dir="ltr"
                    style={{ minWidth: 0, width: '100%', paddingTop: 0 }}
                  />
                </div>
              )}
              <button className="btn btn-primary" onClick={sendSheetToWa} disabled={sheetBusy || wa.status !== 'connected'}>
                <Ic n="i-out" sm /> {sheetBusy ? 'جارٍ الإرسال…' : 'إرسال الشيت'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>
              تُرسل الحركات مع المبالغ ومراكز التكلفة في رسالة منسّقة. المجموعات تظهر بعد ربط الجهاز.
            </div>
          </div>

          {/* تشخيص: هل تصل الرسائل إلى الخادم؟ */}
          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="kpi-label" style={{ fontWeight: 600, color: 'var(--txt-2)' }}>
                تشخيص الوصول — آخر الرسائل التي وصلت للخادم
              </div>
              <button
                className="btn btn-sm"
                style={{ marginInlineStart: 'auto' }}
                onClick={runSelfTest}
                disabled={sheetBusy || wa.status !== 'connected'}
                title="يرسل رسالة من رقمك إلى محادثة نفسك ويظهر هل وصلت ونتيجة معالجتها"
              >
                <Ic n="i-bolt" sm /> {sheetBusy ? 'جارٍ الفحص…' : 'فحص الاستقبال الآن'}
              </button>
            </div>
            {selfTest && (
              <div
                style={{
                  fontSize: 12.5,
                  borderRadius: 10,
                  padding: '8px 11px',
                  background: selfTest.ok ? 'var(--in-bg)' : 'var(--out-bg)',
                  color: selfTest.ok ? 'var(--in)' : 'var(--out)',
                }}
              >
                <b>{selfTest.ok ? '✔ ' : '✖ '}</b>
                {selfTest.msg} <span style={{ opacity: 0.7 }}>({selfTest.at})</span>
              </div>
            )}
            {raw.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--txt-3)', lineHeight: 1.9 }}>
                لا رسائل وصلت بعد. تأكّد من:
                <b> 1)</b> الحالة «مرتبط» أعلاه،
                <b> 2)</b> أنك ترسل من رقم آخر إلى هذا الرقم أو إلى مجموعة هو عضو فيها،
                <b> 3)</b> أو أرسل إلى <b>محادثة نفسك</b> (Message yourself).
              </div>
            ) : (
              <div className="table-scroll">
                <table style={{ minWidth: 560 }}>
                  <thead>
                    <tr><th>الوقت</th><th>المحادثة</th><th>الرسالة</th><th>ما جرى</th></tr>
                  </thead>
                  <tbody>
                    {raw.map((e, i) => (
                      <tr key={i}>
                        <td className="num" style={{ fontSize: 11.5 }}>{new Date(e.at).toLocaleTimeString('en-GB')}</td>
                        <td style={{ fontSize: 11.5, direction: 'ltr' }}>
                          {e.chat.split('@')[0]}
                          {e.chat.endsWith('@g.us') ? ' (مجموعة)' : ''}
                          {e.fromMe ? ' · صادرة' : ''}
                        </td>
                        <td style={{ fontSize: 12, maxWidth: 240, color: 'var(--txt-2)' }}>{e.text || '—'}</td>
                        <td style={{ fontSize: 11.5 }}>
                          <span className={`badge ${e.action.includes('حركة') ? 'posted' : e.action.includes('تجاهل') || e.action.includes('غير') ? 'failed' : 'pending'}`}>
                            <i />{e.action}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* آخر الرسائل */}
          <div className="table-scroll">
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr><th>الوقت</th><th>من</th><th>الرسالة</th><th>الحركة</th></tr>
              </thead>
              <tbody>
                {(inbox?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty" style={{ padding: 22 }}>
                        <b style={{ fontSize: 13 }}>لا رسائل بعد</b>
                        <div>أرسل رسالة إلى الرقم المرتبط، أو جرّب الزر أعلاه.</div>
                      </div>
                    </td>
                  </tr>
                )}
                {(inbox?.items ?? []).map((it, i) => (
                  <tr key={i}>
                    <td className="num" style={{ fontSize: 11.5 }}>{new Date(it.at).toLocaleString('en-GB')}</td>
                    <td style={{ fontSize: 12 }}>{it.fromName}</td>
                    <td style={{ fontSize: 12, color: 'var(--txt-2)', maxWidth: 260 }}>{it.text}</td>
                    <td>
                      {it.ok ? (
                        <span className="badge posted"><i />{it.opId} · {Number(it.amount ?? 0).toLocaleString('en-US')}</span>
                      ) : (
                        <span className="badge failed"><i />{it.reason ?? 'غير مفهومة'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================= سجل الأحداث ================= */}
      <div className="card panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <div>
            <h3>سجل أحداث التكامل</h3>
            <div className="sub">آخر ما جرى من إرسال/استقبال (في الذاكرة — استبدله بجدول في قاعدة البيانات)</div>
          </div>
        </div>
        <div className="table-scroll">
          <table style={{ minWidth: 640 }}>
            <thead>
              <tr><th>الوقت</th><th>القناة</th><th>النتيجة</th><th>التفاصيل</th></tr>
            </thead>
            <tbody>
              {status.events.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty" style={{ padding: 30 }}>
                      <b style={{ fontSize: 13.5 }}>لا أحداث بعد</b>
                      <div>جرّب زر «إرسال» أو «مزامنة عملية تجريبية» أعلاه.</div>
                    </div>
                  </td>
                </tr>
              )}
              {status.events.map((e, i) => (
                <tr key={i}>
                  <td className="num" style={{ fontSize: 12 }}>{new Date(e.at).toLocaleString('en-GB')}</td>
                  <td>
                    <span className="pill-method">{e.ch === 'whatsapp' ? 'واتساب' : 'وكيد'}</span>
                  </td>
                  <td>
                    <span className={`badge ${e.ok ? 'posted' : 'failed'}`}><i />{e.ok ? 'نجح' : 'فشل'}</span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--txt-2)' }}>{e.msg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span className="kpi-ic" style={{ ['--accent' as string]: 'var(--wait)', background: 'var(--wait-bg)', color: 'var(--wait)' }}>
          <Ic n="i-alert" sm />
        </span>
        <div style={{ fontSize: 12.5, color: 'var(--txt-2)', lineHeight: 1.85 }}>
          <b>تنبيه للإنتاج:</b> لا تُرسل الرسائل أثناء معالجة الطلب مباشرة عند وجود أحجام كبيرة — استخدم طابورًا
          (BullMQ/Redis أو SQS) مع إعادة محاولة و«مفتاح منع تكرار» (external_id) لتفادي فاتورتين لنفس العملية.
          كذلك خزّن المفاتيح في مدير أسرار لا في المستودع.
        </div>
      </div>
    </>
  );
}
