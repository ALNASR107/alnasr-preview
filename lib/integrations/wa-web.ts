/**
 * ربط واتساب عبر «الأجهزة المرتبطة» (WhatsApp Web / Multi-Device) باستخدام Baileys.
 *
 * ⚠️ ملاحظات مهمة:
 *  - هذا المسار غير رسمي (ليس Cloud API) ويعتمد على بروتوكول واتساب ويب.
 *    استخدامه يخالف شروط خدمة واتساب وقد يعرّض الرقم للحظر — يُستخدم على مسؤوليتك،
 *    والأنسب للإنتاج هو Cloud API. استخدم هذا الربط لأرقام داخلية/تشغيلية.
 *  - الجلسة تُخزَّن في مجلد `.wa-auth` (مفاتيح تشفير الجهاز). لا ترفعه للمستودع،
 *    ومن يملكه يستطيع التصرّف بالحساب — احمِه كما تحمي كلمة المرور.
 *  - يحتاج خادمًا دائم التشغيل (process) — لا يعمل على Serverless/Edge.
 */
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { logEvent } from './log';
import { getOperation, updateStatus } from '@/lib/mock';
import { ingestMessage } from './wa-inbox';
import { cacheHistory, clearHistory, scheduleHistory } from './wa-history';
import { dateInTz, todayInTz } from '@/lib/dates';
import { groupMode } from './group-rules';
import { processImage } from './image-ocr';
import { recordBulletin, parseRateBulletin } from './group-fx';
import { groupSenderPhone } from './sender-direction';
import { referenceOf } from './forward-link';
import { archiveDisplayMessage, archiveReaction, displayEntries } from './wa-display';

export type WaWebStatus = 'idle' | 'starting' | 'qr' | 'pairing' | 'connected' | 'closed' | 'error';

type Store = {
  sock: any;
  status: WaWebStatus;
  qr: string | null;
  qrDataUrl: string | null;
  me: string | null;
  error: string | null;
  startedAt: number | null;
  manualLogout: boolean;
  retries: number;
  pairingCode: string | null;
  pairingPhone: string | null;
  /** آخر الأحداث الخام (تشخيص: هل تصل الرسائل؟) */
  recent: { at: string; chat: string; fromMe: boolean; text: string; action: string }[];
  /** معرّفات الرسائل التي أرسلناها (لمنع تحويل ردودنا إلى حركات) */
  sentIds: string[];
  /** أسماء المجموعات (jid → الاسم) */
  groupNames: Record<string, string>;
};

const g = globalThis as unknown as { __amanahWaStore?: Store; __nasrPeriodicHistory?: NodeJS.Timeout };

const store: Store =
  g.__amanahWaStore ??
  (g.__amanahWaStore = {
    sock: null,
    status: 'idle',
    qr: null,
    qrDataUrl: null,
    me: null,
    error: null,
    startedAt: null,
    manualLogout: false,
    retries: 0,
    pairingCode: null,
    pairingPhone: null,
    recent: [],
    sentIds: [],
    groupNames: {},
  });

const AUTH_DIR = process.env.WA_AUTH_DIR ?? './.wa-auth';

/** هل توجد جلسة محفوظة على القرص؟ (لاستئناف الربط بعد إعادة تشغيل الخادم) */
export function hasStoredSession(): boolean {
  try {
    return fs.existsSync(path.join(AUTH_DIR, 'creds.json'));
  } catch {
    return false;
  }
}

/** اسم المجموعة المحدث من واتساب، إن كان متاحاً. */
export function waGroupName(jid: string): string | undefined {
  if (!jid.endsWith('@g.us')) return undefined;
  const name = store.groupNames[jid]?.trim();
  return name || undefined;
}

export function waWebState() {
  return {
    status: store.status,
    qr: store.qrDataUrl,
    pairingCode: store.pairingCode,
    pairingCodePretty: store.pairingCode ? `${store.pairingCode.slice(0, 4)}-${store.pairingCode.slice(4)}` : null,
    pairingPhone: store.pairingPhone,
    me: store.me,
    error: store.error,
    startedAt: store.startedAt,
    hasSession: Boolean(store.sock),
    authDir: AUTH_DIR,
    recent: store.recent.slice(0, 20),
  };
}

/* ------------------------------------------------------------------ */
/*  بدء الجلسة / إعادة الاتصال                                         */
/* ------------------------------------------------------------------ */

export async function startWaWeb(opts?: { phone?: string }): Promise<ReturnType<typeof waWebState>> {
  if (store.status === 'connected' || store.status === 'starting' || store.status === 'qr' || store.status === 'pairing') {
    return waWebState();
  }

  store.status = 'starting';
  store.error = null;
  store.manualLogout = false;
  store.startedAt = Date.now();
  store.pairingCode = null;
  store.pairingPhone = opts?.phone ? opts.phone.replace(/\D/g, '') : null;

  try {
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = (baileys as any).makeWASocket ?? (baileys as any).default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileys as any;

    const silent = {
      level: 'silent',
      child() {
        return silent;
      },
      trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
    };

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version: number[] | undefined;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v?.version;
    } catch {
      /* نكمل بالإصدار الافتراضي */
    }

    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: silent,
      browser: Browsers?.ubuntu?.('Al-Nasr Ops') ?? ['Al-Nasr Ops', 'Chrome', '1.0'],
      syncFullHistory: true,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    store.sock = sock;

    // منع كل الرسائل الصادرة من التطبيق، بما فيها الردود والاختبار والملخصات.
    sock.sendMessage = async () => { throw new Error('إرسال الرسائل معطّل بطلب المستخدم'); };

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('groups.update', (updates: any[]) => {
      for (const group of updates || []) {
        if (group?.id && typeof group.subject === 'string' && group.subject.trim()) store.groupNames[group.id] = group.subject.trim();
      }
    });

    /*
     * الربط برمز الاقتران (بدل مسح QR):
     * واتساب ← الإعدادات ← الأجهزة المرتبطة ← «الربط برقم الهاتف بدلًا من ذلك» ثم أدخل الرمز.
     */
    if (store.pairingPhone) {
      const phone = store.pairingPhone;
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phone);
          store.pairingCode = String(code);
          store.status = 'pairing';
          logEvent({ ch: 'whatsapp', ok: true, msg: `رمز اقتران جديد للرقم ${phone}` });
        } catch (e) {
          store.status = 'error';
          store.error = `تعذّر إنشاء رمز الاقتران: ${(e as Error).message}`;
          logEvent({ ch: 'whatsapp', ok: false, msg: store.error });
        }
      }, 3000);
    }

    sock.ev.on('connection.update', async (u: any) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        // عند الربط برمز الاقتران نُبقي الرمز بدل إظهار QR
        if (store.pairingPhone) return;
        store.qr = qr;
        store.status = 'qr';
        try {
          store.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
        } catch {
          store.qrDataUrl = null;
        }
        logEvent({ ch: 'whatsapp', ok: true, msg: 'رمز QR جديد بانتظار المسح' });
      }

      if (connection === 'open') {
        // جلب أسماء المجموعات (لإنشاء شيت باسم المجموعة)
        setTimeout(async () => {
          try {
            const all = await sock.groupFetchAllParticipating();
            const map: Record<string, string> = {};
            for (const gid of Object.keys(all ?? {})) map[gid] = String((all as any)[gid]?.subject ?? '');
            store.groupNames = { ...store.groupNames, ...map };
            console.log('[wa] أسماء المجموعات:', Object.keys(map).length);
          } catch {
            /* تجاهل */
          }
        }, 1500);
        store.status = 'connected';
        store.qr = null;
        store.qrDataUrl = null;
        store.retries = 0;
        store.pairingCode = null;
        store.me = sock.user?.id ? String(sock.user.id).split(':')[0].split('@')[0] : null;
        if (store.me) scheduleHistory(store.me, 30000);
        if (!g.__nasrPeriodicHistory) {
          g.__nasrPeriodicHistory = setInterval(() => {
            if (store.status === 'connected' && store.me) scheduleHistory(store.me, 0);
          }, 60000);
          g.__nasrPeriodicHistory.unref?.();
        }
        logEvent({ ch: 'whatsapp', ok: true, msg: `تم ربط الجهاز: ${store.me ?? 'واتساب'}` });
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason?.loggedOut;
        store.me = null;
        store.qr = null;
        store.qrDataUrl = null;
        store.pairingCode = null;

        if (loggedOut || store.manualLogout) {
          store.status = 'closed';
          logEvent({ ch: 'whatsapp', ok: true, msg: 'تم فصل الجهاز' });
          return;
        }

        // إعادة محاولة تلقائية (حد أقصى 5)
        if (store.retries < 5) {
          store.retries += 1;
          store.status = 'starting';
          logEvent({ ch: 'whatsapp', ok: false, msg: `انقطع الاتصال (${code ?? '?'}) — محاولة ${store.retries}` });
          setTimeout(() => {
            store.sock = null;
            store.status = 'idle';
            void startWaWeb();
          }, 2000 * store.retries);
        } else {
          store.status = 'error';
          store.error = 'تعذّر الاتصال بواتساب بعد عدة محاولات';
          logEvent({ ch: 'whatsapp', ok: false, msg: store.error });
        }
      }
    });

    // لا ترحيل تلقائي للتاريخ؛ نحفظ فقط مرشحات أمس إلى حين الضغط على الزر.
    sock.ev.on('messaging-history.set', async (evt: any) => {
      const names: Record<string, string> = {};
      for (const c of evt?.chats || []) if (c?.id && c?.name) names[c.id] = String(c.name);
      const owner = String(sock.user?.id || '').split(':')[0].split('@')[0];
      for (const m of evt?.messages || []) if (m?.message?.reactionMessage) archiveReaction(m);
      await cacheHistory(evt?.messages || [], owner, { ...store.groupNames, ...names }, sock);
      scheduleHistory(owner, 30000);
    });

    sock.ev.on('messages.reaction', (updates: any[]) => {
      for (const u of updates || []) {
        if (!u?.key?.id || !u?.reaction?.key) continue;
        archiveReaction({ key: { ...u.reaction.key, remoteJid: u.key.remoteJid }, messageTimestamp: Math.floor(Date.now()/1000), message: { reactionMessage: { ...u.reaction, key: u.key } } });
      }
    });

    /* --------- استقبال الرسائل وتنفيذ الأوامر --------- */
    sock.ev.on('messages.upsert', async (evt: any) => {
      // تشخيص: نُسجّل كل دفعة رسائل واردة (نوعها وعددها)
      console.log('[wa] messages.upsert', evt?.type, Array.isArray(evt?.messages) ? evt.messages.length : 0);
      if (evt?.type !== 'notify' && evt?.type !== 'append') return;
      for (const m of evt.messages ?? []) {
        try {
          if (!m?.message) continue;
          const displayJid = String(m.key?.remoteJid || '');
          if (displayJid && displayJid !== 'status@broadcast') {
            const displayName = store.groupNames[displayJid] || (displayJid.endsWith('@g.us') ? `مجموعة ${displayJid.split('@')[0]}` : m.pushName || `محادثة ${displayJid.split('@')[0]}`);
            void archiveDisplayMessage(m, displayName).catch(err => console.error('[wa-display]', err));
          }
          if (m?.message?.reactionMessage) continue;
          const sec = Number(m?.messageTimestamp);
          if (Number.isFinite(sec) && sec > 0 && dateInTz(new Date(sec * 1000)) !== todayInTz()) {
            const owner = String(sock.user?.id || '').split(':')[0].split('@')[0];
            await cacheHistory([m], owner, store.groupNames, sock);
            scheduleHistory(owner, 30000);
            continue;
          }
          if (evt.type === 'append') {
            const owner = String(sock.user?.id || '').split(':')[0].split('@')[0];
            await cacheHistory([m], owner, store.groupNames, sock);
            scheduleHistory(owner, 30000);
            continue;
          }
          const jid: string = m.key.remoteJid ?? '';
          if (jid === 'status@broadcast' || jid === 'broadcast') continue;

          const msgId: string = m.key?.id ?? '';
          const fromMe = Boolean(m.key?.fromMe);
          const isGroup = jid.endsWith('@g.us');
          const senderPhone = isGroup ? await groupSenderPhone(m, sock) : undefined;
          // حفظ النص المتاح لإعادة فحصه كل دقيقة وفق القواعد الحالية.
          const owner = String(sock.user?.id || '').split(':')[0].split('@')[0];
          if (owner) { await cacheHistory([m], owner, store.groupNames, sock); scheduleHistory(owner, 30000); }
          if (isGroup) {
            if ((process.env.WA_INGEST_ENABLED ?? '1') === '0' || (process.env.WA_INGEST_GROUPS ?? '1') === '0') continue;
            if (fromMe && (process.env.WA_INGEST_FROM_ME ?? '1') === '0') continue;
            // نشرات الأسعار نصوص معلوماتية وليست حركات، حتى في مجموعة الصور.
            const bulletinText = String(m.message.conversation ?? m.message.extendedTextMessage?.text ?? '');
            if (bulletinText && msgId && Number.isFinite(sec) && sec > 0 && groupMode(jid) !== 'off') {
              const added = recordBulletin({ chat: jid, text: bulletinText, messageId: msgId, at: new Date(sec * 1000).toISOString() });
              if (added) logEvent({ ch: 'whatsapp', ok: true, msg: `تم تسجيل نشرة قص لمجموعة (${added} عملة)` });
              if (parseRateBulletin(bulletinText).length) continue;
            }

            const mode = groupMode(jid);
            const hasImage = Boolean(m.message.imageMessage);
            const hasText = Boolean(m.message.conversation || m.message.extendedTextMessage?.text);
            if (mode === 'off') continue;
            if (mode === 'images') {
              if (hasImage) await processImage(m, store.groupNames[jid] || `مجموعة ${jid.split('@')[0]}`, senderPhone);
              continue;
            }
            // في وضع النص لا نستخدم تعليقات الصور أو أي مرفق كنص مالي.
            if (!hasText || hasImage) continue;
          }

          if (isGroup) {
            // ننتظر دفعة المزامنة القصيرة لمقارنة مرجع الرسالة بنسختها المحوّلة أولاً.
            continue;
          }

          const myJid = store.me ? `${store.me}@s.whatsapp.net` : '';
          const isSelfChat = Boolean(myJid) && jid === myJid;

          const text: string =
            m.message.conversation ??
            m.message.extendedTextMessage?.text ??
            m.message.imageMessage?.caption ??
            m.message.videoMessage?.caption ??
            m.message.documentMessage?.caption ??
            m.message.buttonsResponseMessage?.selectedButtonId ??
            m.message.listResponseMessage?.singleSelectReply?.selectedRowId ??
            '';

          const noteEvent = (action: string) => {
            store.recent = [
              { at: new Date().toISOString(), chat: jid, fromMe, text: String(text).slice(0, 160), action },
              ...store.recent,
            ].slice(0, 20);
          };


          // تجاهل ردودنا نفسها (تأكيدات النظام) لمنع تكرار الحركات
          if (msgId && store.sentIds.includes(msgId)) {
            noteEvent('ردّ النظام — تم تجاهله');
            continue;
          }
          // رسالة صادرة من نفس الرقم (مثال: ترسلها من جوالك المرتبط):
          // تُقبل فقط في محادثة «نفسك» أو إذا بدأت بـ # أو إذا فُعّل WA_INGEST_FROM_ME=1
          const forced = /^\s*[#!]/.test(String(text));
          const allowFromMe = (process.env.WA_INGEST_FROM_ME ?? '1') === '1';
          if (fromMe && !isSelfChat && !forced && !allowFromMe) {
            noteEvent('رسالة صادرة — تم تجاهلها (WA_INGEST_FROM_ME=0)');
            continue;
          }

          // لا نردّ على رسائل صادرة من نفس الحساب (إلا في محادثة «نفسك») حتى لا نزعج العملاء
          const shouldReply = false;

          const match = String(text).match(/(قبول|اعتماد|رفض)\s*(OP-\d+)/i);
          if (match) {
            noteEvent('أوامر الاعتماد عبر واتساب معطّلة');
          } else {
            /*
             * استقبال الحركات وفق صيغة مالية واضحة فقط، دون إرسال ردود.
             * WA_INGEST_ENABLED=0  → إيقاف الاستقبال.
             * WA_INGEST_GROUPS=0   → تجاهل رسائل المجموعات.
             */
            const ingestOn = (process.env.WA_INGEST_ENABLED ?? '1') !== '0';
            const allowGroups = (process.env.WA_INGEST_GROUPS ?? '1') !== '0';

            if (!ingestOn || (isGroup && !allowGroups)) {
              noteEvent('الاستقبال معطّل أو المجموعات متجاهلة');
              if (shouldReply) await sock.sendMessage(jid, {
                text: 'أرسل حركة بهذا الشكل: «تحويل 500000 من شركة النور بنك»، أو أمرًا: «اعتماد OP-24599».',
              });
              logEvent({ ch: 'whatsapp', ok: true, msg: `رسالة واردة من ${jid}: ${String(text).slice(0, 40)}` });
            } else {
              // اسم الشيت: اسم المجموعة أو اسم المرسل
              let chatName = store.groupNames[jid] ?? '';
              if (!chatName && isGroup) {
                try {
                  const meta = await sock.groupMetadata(jid);
                  chatName = String(meta?.subject ?? '');
                  if (chatName) store.groupNames[jid] = chatName;
                } catch {
                  /* تجاهل */
                }
              }
              if (!chatName) chatName = m.pushName || '';
              // أسماء بديلة واضحة بدل الأرقام
              if (!chatName || /^\d+$/.test(chatName)) {
                chatName = isSelfChat
                  ? 'محادثة نفسي'
                  : isGroup
                  ? `مجموعة ${jid.split('@')[0]}`
                  : `محادثة ${jid.split('@')[0]}`;
              }

              const res = ingestMessage({
                text: String(text),
                messageId: msgId || undefined,
                messageDate: Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000).toISOString() : undefined,
                fromMe,
                senderPhone,
                mediaType: m.message.imageMessage ? 'image' : m.message.videoMessage ? 'video' : m.message.documentMessage ? 'document' : m.message.audioMessage ? 'audio' : undefined,
                chat: jid,
                fromName: m.pushName || jid.split('@')[0],
                chatName,
              });

              if (res.ok && res.op) {
                noteEvent(`حركة ${res.op.id} — ${res.op.amount.toLocaleString('en-US')}`);
                const op = res.op;
                const amountFmt = op.amount.toLocaleString('en-US');
                if (shouldReply) await sock.sendMessage(jid, {
                  text:
                    `✅ تم تسجيل الحركة وترحيلها إلى شيت الموقع\n` +
                    `• رقم الحركة: ${op.id}\n` +
                    `• المبلغ: ${amountFmt} ${op.currency}\n` +
                    `• النوع: ${op.type} · ${op.dir === 'in' ? 'وارد' : 'صادر'} · ${op.method}\n` +
                    `• الحساب: ${op.account}\n` +
                    `• العميل/الجهة: ${op.customer}\n` +
                    (res.sheetName ? `• الشيت: ${res.sheetName}\n` : '') +
                    (res.line ? `• سطر الشيت: ${res.line.id} · ${res.line.costCenter}` : ''),
                });
                logEvent({
                  ch: 'whatsapp',
                  ok: true,
                  msg: `حركة واردة من واتساب: ${op.id} — ${amountFmt} ${op.currency}`,
                });
              } else {
                noteEvent('غير مفهومة — لا مبلغ');
                if (shouldReply) await sock.sendMessage(jid, {
                  text:
                    'لم أجد مبلغًا واضحًا في الرسالة.\nأمثلة يعمل بها النظام:\n' +
                    '• تحويل 500000 من شركة النور بنك\n' +
                    '• دفع فاتورة 150000 كهرباء كاش\n' +
                    '• إيداع 2,750,000 مخبز السنابل محفظة',
                });
                logEvent({ ch: 'whatsapp', ok: false, msg: `رسالة غير مفهومة من ${jid}: ${String(text).slice(0, 40)}` });
              }
            }
          }
        } catch (e) {
          logEvent({ ch: 'whatsapp', ok: false, msg: `خطأ في معالجة رسالة: ${(e as Error).message}` });
        }
      }
    });

    // مهلة: إن لم يصل QR ولا اتصال خلال 45 ثانية
    setTimeout(() => {
      if (store.status === 'starting') {
        store.status = 'error';
        store.error = 'لم يصل رمز QR من واتساب — تحقّق من الشبكة وأعد المحاولة';
      }
    }, 45_000);

    return waWebState();
  } catch (e) {
    store.status = 'error';
    store.error = (e as Error).message;
    logEvent({ ch: 'whatsapp', ok: false, msg: `فشل بدء الربط: ${store.error}` });
    return waWebState();
  }
}

/* ------------------------------------------------------------------ */
/*  قطع الربط                                                          */
/* ------------------------------------------------------------------ */

export async function logoutWaWeb() {
  clearHistory();
  store.manualLogout = true;
  try {
    await store.sock?.logout?.();
  } catch {
    /* تجاهل */
  }
  try {
    await store.sock?.end?.(undefined);
  } catch {
    /* تجاهل */
  }
  store.sock = null;
  store.status = 'idle';
  store.qr = null;
  store.qrDataUrl = null;
  store.me = null;
  store.groupNames = {};
  store.error = null;
  logEvent({ ch: 'whatsapp', ok: true, msg: 'تم إنهاء جلسة الجهاز' });
  return waWebState();
}

/* ------------------------------------------------------------------ */
/*  الإرسال                                                            */
/* ------------------------------------------------------------------ */

export function waWebConnected() {
  return store.status === 'connected' && Boolean(store.sock);
}

/** حلّ الهدف: رقم هاتف أو JID مجموعة أو اسم مجموعة */
export function resolveWaTarget(to: string): string {
  const t = (to || '').trim();
  if (t.includes('@')) return t; // JID جاهز (مجموعة أو مستخدم)
  const digits = t.replace(/[^\d]/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

/** طلب دفعة تاريخ من الجهاز المرتبط للمحادثة المتاحة، وليس رسالة للمجموعة. */
const historyRequests = globalThis as unknown as { __nasrHistoryRequestAt?: Record<string,number> };
export async function requestOlderHistory(chat: string) {
  if (!waWebConnected() || !store.sock) return { ok:false, error:'واتساب غير متصل', status:409 };
  const oldest = displayEntries().filter(x => x.chat === chat && x.messageId && Number.isFinite(Date.parse(x.at)))
    .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];
  if (!oldest) return { ok:false, error:'لا توجد رسالة محفوظة في هذه المحادثة لبدء طلب السجل', status:404 };
  if (!chat.endsWith('@g.us') && !chat.endsWith('@s.whatsapp.net') && !chat.endsWith('@lid')) return { ok:false, error:'المحادثة غير مدعومة', status:400 };
  const map = (historyRequests.__nasrHistoryRequestAt ??= {});
  if (Date.now() - (map[chat] || 0) < 15000) return { ok:false, error:'انتظر ١٥ ثانية قبل طلب دفعة أخرى', status:429 };
  map[chat] = Date.now();
  try {
    await store.sock.fetchMessageHistory(50, { remoteJid:chat, id:oldest.messageId, fromMe:oldest.fromMe }, Math.floor(Date.parse(oldest.at)/1000));
    return { ok:true, status:200, note:'تم طلب دفعة حتى ٥٠ رسالة من الجهاز المرتبط؛ وصولها غير مضمون وقد يتأخر.' };
  } catch { delete map[chat]; return { ok:false, error:'تعذّر طلب السجل من الجهاز المرتبط', status:502 }; }
}

/** قائمة مجموعات واتساب المتاحة (لإرسال الشيت إليها) */
export async function listWaGroups(): Promise<{ jid: string; name: string; size: number }[]> {
  if (!waWebConnected()) return [];
  try {
    const all = await store.sock.groupFetchAllParticipating();
    for (const group of Object.values(all ?? {}) as any[]) if (group?.id && group?.subject) store.groupNames[group.id] = String(group.subject);
    return Object.values(all ?? {}).map((g: any) => ({
      jid: String(g.id),
      name: String(g.subject ?? g.id),
      size: Array.isArray(g.participants) ? g.participants.length : 0,
    }));
  } catch (e) {
    logEvent({ ch: 'whatsapp', ok: false, msg: `تعذّر جلب المجموعات: ${(e as Error).message}` });
    return [];
  }
}

/** إرسال نص عبر الجهاز المرتبط (رقم أو JID مجموعة). `track:false` لرسائل الفحص الذاتي */
export async function sendWaWebText(_to: string, _text: string, _opts?: { track?: boolean }) {
  return { ok: false, error: 'إرسال الرسائل معطّل بطلب المستخدم', id: undefined as string | undefined };
}

/**
 * فحص الاستقبال: يرسل رسالة إلى محادثة «نفسك» بنص فيه مبلغ،
 * ثم ينتظر قليلًا ويعيد ما وصل إلى الخادم ونتيجة معالجته.
 * مفيد للتأكد من أن الاستقبال يعمل بلا حاجة لجهاز ثانٍ.
 */
export async function selfTestIngest(amount = 1000) {
  if (!waWebConnected() || !store.me) return { ok: false, error: 'واتساب غير مرتبط' };

  const selfJid = `${store.me}@s.whatsapp.net`;
  const text = `فحص استقبال ${amount} من تجربة النظام #فحص`;

  const before = store.recent.length;
  await sendWaWebText(selfJid, text, { track: false });

  // ننتظر وصول الصدى من واتساب ومعالجته
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (store.recent.length > before || store.recent.some((e) => e.text.includes(`فحص استقبال ${amount}`))) break;
  }

  const hit = store.recent.find((e) => e.text.includes(`فحص استقبال ${amount}`));
  return { ok: Boolean(hit), sentTo: selfJid, text, event: hit ?? null, recent: store.recent.slice(0, 6) };
}


