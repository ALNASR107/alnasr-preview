import { groupCurrencyMode } from './group-rules';
import { groupPostingAmount } from './group-fx';
/** استقبال نصوص واتساب بصيغة مالية واضحة فقط. أي نص غير واضح يُرفض بلا ترحيل.
 * الصيغة وحدها ليست إثباتاً خارجياً على أن التحويل حدث فعلاً.
 */
import type { Operation } from '@/lib/types';
import { allOperations, createOperation } from '@/lib/mock';
import { dateInTz } from '@/lib/dates';
import { makeFx } from './group-fx';
import { senderDirection } from './sender-direction';
import { listLines, postToSheet, type SheetLine } from '@/lib/sheet';
import { ensureSheetForChat } from '@/lib/sheets';
import { readJson, writeJson } from '@/lib/store';

export type InboxItem = {
  at: string;
  messageId?: string;
  fromMe?: boolean;
  mediaType?: string;
  chat: string; // jid
  chatName?: string;
  sheetId?: string;
  sheetName?: string;
  fromName: string;
  text: string;
  ok: boolean;
  opId?: string;
  lineId?: string;
  amount?: number;
  reason?: string;
};

export type ParsedOp = {
  amount: number;
  dir: 'in' | 'out';
  type: string;
  method: string;
  customer: string;
  currency: string;
};

/** العملات المدعومة: الرمز الظاهر في الشيت ← كلمات التعرف في الرسالة */
const CURRENCY_RULES: { currency: string; words: string[] }[] = [
  { currency: 'USD', words: ['دولار', 'دولارامريكي', 'usd', '$', 'دولار أمريكي', 'الأمريكي'] },
  { currency: 'EGP', words: ['جنيه', 'جنيهات', 'جنيه مصري', 'egp', 'ج.م', 'جم'] },
  { currency: 'TRY', words: ['ليرة تركية', 'تركي', 'try', 'tl'] },
  { currency: 'SYP', words: ['ليرة', 'ليره', 'ل.س', 'syp', 'ليرة سورية', 'سوري'] },
  { currency: 'SAR', words: ['ريال', 'ريال سعودي', 'sar', 'ر.س'] },
  { currency: 'AED', words: ['درهم', 'درهم إماراتي', 'aed'] },
  { currency: 'JOD', words: ['دينار', 'دينار أردني', 'jod'] },
  { currency: 'EUR', words: ['يورو', 'euro', 'eur', '€'] },
];

/** كشف العملة من نص الرسالة، وإلا العملة الافتراضية من البيئة */
export function detectCurrency(text: string): string {
  const low = (text || '').toLowerCase();
  for (const rule of CURRENCY_RULES) {
    if (rule.words.some((w) => low.includes(w.toLowerCase()))) return rule.currency;
  }
  return (process.env.DEFAULT_CURRENCY || 'USD').toUpperCase();
}

const IN_WORDS = ['وارد', 'إيداع', 'ايداع', 'قبض', 'استلام', 'دخل', 'تحصيل', 'استرداد'];
const OUT_WORDS = ['صادر', 'سحب', 'دفع', 'مصروف', 'مصاريف', 'صرف', 'تحويل إلى', 'تحويل الي', 'شحن'];

const TYPE_RULES: { type: string; words: string[] }[] = [
  { type: 'دفع فاتورة', words: ['فاتورة', 'فواتير', 'كهرباء', 'اتصالات', 'إيجار', 'ايجار', 'انترنت', 'إنترنت'] },
  { type: 'استرداد', words: ['استرداد', 'إرجاع', 'ارجاع', 'مرتجع'] },
  { type: 'تسوية', words: ['تسوية', 'فروقات', 'فرق صندوق'] },
  { type: 'إيداع', words: ['إيداع', 'ايداع', 'إيداع نقدي'] },
  { type: 'سحب', words: ['سحب', 'سلفة', 'مسحوبات'] },
  { type: 'شحن رصيد', words: ['شحن رصيد', 'شحن محفظة', 'شحن'] },
  { type: 'تحويل', words: ['تحويل', 'حوالة', 'دفعة', 'حوالة بنكية'] },
];

const METHOD_RULES: { method: string; words: string[] }[] = [
  { method: 'بنك', words: ['بنك', 'مصرف', 'حساب جار', 'IBAN', 'iban', 'حوالة بنكية'] },
  { method: 'محفظة', words: ['محفظة', 'الكتروني', 'إلكتروني', 'موبايل', 'wallet'] },
  { method: 'بطاقة', words: ['بطاقة', 'فيزا', 'ماستر', 'card'] },
  { method: 'شيك', words: ['شيك', 'صك'] },
  { method: 'كاش', words: ['كاش', 'نقد', 'نقدي', 'يد'] },
];

const ACCOUNT_BY_METHOD: Record<string, string> = {
  'بنك': 'حساب المصرف التجاري',
  'كاش': 'الصندوق الرئيسي',
  'محفظة': 'محفظة الثقة',
  'بطاقة': 'حساب البطاقات',
  'شيك': 'شيكات برسم التحصيل',
};

/** استخراج المبلغ من نص عربي (يدعم 1,250,000 و 1.250.000 و 500 ألف) */
export function extractAmount(text: string): number | undefined {
  const cleaned = text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

  const m = cleaned.match(/(\d[\d.,\s]*\d|\d)/);
  if (!m) return undefined;

  let raw = m[1].replace(/\s/g, '');
  // فواصل الآلاف: إزالة الفواصل إذا كان الجزء الأخير 3 أرقام
  if (/[.,]/.test(raw)) {
    const parts = raw.split(/[.,]/);
    const last = parts[parts.length - 1];
    if (last.length === 3 && parts.length > 1) raw = parts.join('');
    else raw = parts[0] + '.' + last; // عشري
  }
  let n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;

  // «500 ألف» / «2 مليون»
  const after = cleaned.slice((m.index ?? 0) + m[1].length, (m.index ?? 0) + m[1].length + 12);
  if (/(ألف|الف|آلاف)/.test(after)) n *= 1_000;
  else if (/(مليون|ملايين)/.test(after)) n *= 1_000_000;
  return Math.round(n);
}

/** قبول صيغة ضيقة فقط: فعل مالي منجز + مبلغ واحد + عملة صريحة.
 * هذا يتحقق من صياغة الرسالة لا من حدوث الحركة فعلياً لدى البنك. */
export function parseOperationText(text: string): ParsedOp | undefined {
  const t = (text || '').trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const match = t.match(/^(تم\s+(قبض|استلام|تحصيل|إيداع|ايداع|دفع|سحب|صرف|تحويل)|قبضت|استلمت|دفعت|سحبت|حولت|وارد|صادر)\s+(\d+(?:[,.]\d+)*)\s*(دولار(?: أمريكي)?|USD|\$|جنيه(?: مصري)?|EGP|ليرة سورية|ليره سورية|SYP|ليرة تركية|TRY|ريال سعودي|SAR|درهم إماراتي|AED|دينار أردني|JOD|يورو|EUR|€)(?:\s+(من|إلى|الى)\s+([\p{L}\s]{2,60}))?\s*[.!]?$/iu);
  if (!match) return undefined;
  const action = match[1];
  const raw = match[3];
  // أكثر من فاصل أو تنسيق مبهم لا يُرحّل بالتخمين.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)) return undefined;
  const amount = Number(raw.replace(/,/g, ''));
  if (!Number.isSafeInteger(amount) || amount <= 0) return undefined;
  const currencyText = match[4].toLowerCase();
  const currencyMap: Record<string, string> = {
    'دولار':'USD', 'دولار أمريكي':'USD', 'usd':'USD', '$':'USD',
    'جنيه':'EGP', 'جنيه مصري':'EGP', 'egp':'EGP',
    'ليرة سورية':'SYP', 'ليره سورية':'SYP', 'syp':'SYP',
    'ليرة تركية':'TRY', 'try':'TRY', 'ريال سعودي':'SAR', 'sar':'SAR',
    'درهم إماراتي':'AED', 'aed':'AED', 'دينار أردني':'JOD', 'jod':'JOD',
    'يورو':'EUR', 'eur':'EUR', '€':'EUR',
  };
  const directionWord = match[5];
  let dir: 'in' | 'out';
  if (/تحويل|حولت/.test(action)) {
    if (!directionWord) return undefined;
    dir = directionWord === 'من' ? 'in' : 'out';
  } else {
    dir = /دفع|سحب|صرف|دفعت|سحبت|صادر/.test(action) ? 'out' : 'in';
    if ((dir === 'in' && directionWord && directionWord !== 'من') ||
        (dir === 'out' && directionWord === 'من')) return undefined;
  }
  return { amount, dir, type: /إيداع|ايداع/.test(action) ? 'إيداع' : /سحب|سحبت/.test(action) ? 'سحب' : 'تحويل',
    method: 'كاش', customer: match[6]?.trim() || 'مرسل عبر واتساب', currency: currencyMap[currencyText] };
}

/** صيغة «لنا مبلغ عملة» وسط زخارف فقط. لا نستنتج المبلغ من نص ملتبس. */
export function parseLana(text: string): ParsedOp | undefined {
  const normalized = (text || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const rows = normalized.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^[\p{Extended_Pictographic}\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}\s_\-]+$/u.test(x));
  if (rows.length !== 1) return undefined;
  const m = rows[0].match(/^لنا\s+(\d+(?:,\d{3})*)\s*(دولار(?: أمريكي)?|USD|\$|جنيه(?: مصري)?|EGP|ليرة سورية|ليره سورية|SYP|ليرة تركية|TRY|ريال سعودي|SAR|درهم إماراتي|AED|دينار أردني|JOD|يورو|EUR|€)\s*[.!]?$/iu);
  if (!m) return undefined;
  return parseOperationText(`تم قبض ${m[1]} ${m[2]}`);
}

/** شروط المستخدم للترحيل؛ رقم الهاتف المكتوب يختلف عن هوية مرسل واتساب. */
export function postingBlockReason(text: string): string | undefined {
  const t = (text || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if (/[؟?]/u.test(t) || /(?:^|[^\p{L}])(?:لازمني|لازمنا|يلزمني|كم|هل|ليش|متى|امتى|كيف|وين|شو|قديش|بكم)(?:$|[^\p{L}])/u.test(t)) return 'سؤال أو صيغة لازمني؛ لا ترحيل';
  if (/(?:^|[^\p{L}])لنا(?:$|[^\p{L}])/u.test(t)) return undefined;
  // إزالة المبلغ المصحوب بعملة أولاً حتى لا يُحسب رقماً هاتفياً.
  const noAmount = t.replace(/(?:\d+(?:,\d{3})*)[ \t]*(?:دولار(?: أمريكي)?|USD|\$|جنيه(?: مصري)?|EGP|ليرة سورية|ليره سورية|SYP|ليرة تركية|TRY|ريال سعودي|SAR|درهم إماراتي|AED|دينار أردني|JOD|يورو|EUR|€)|(?:دولار(?: أمريكي)?|USD|جنيه(?: مصري)?|EGP|ليرة سورية|ليره سورية|SYP|ليرة تركية|TRY|ريال سعودي|SAR|درهم إماراتي|AED|دينار أردني|JOD|يورو|EUR|€)[ \t]+\d+(?:,\d{3})*/giu, ' ');
  const candidates = noAmount.match(/(?<![\d.,/])\+?\d(?:[ \t()\-]*\d){8,14}(?!\d)(?![.,/]\d)/g) || [];
  if (!candidates.length) return 'لا يوجد رقم هاتف واضح مكتوب في الرسالة';
  return undefined;
}

/** مبلغ واحد بعملة واضحة، بما فيها طلبات التحويل؛ الأرقام الأخرى مثل الهاتف ليست مبالغ. */
export function parseAmountCurrency(text: string): ParsedOp | undefined {
  const t = (text || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  // نشرات الأسعار أو النسب لا تُعامل كحركات مالية.
  if (/(?:سعر|نشرة|قص|تعادل|مكافئ)/u.test(t)) return undefined;
  const currencies = 'دولار(?: أمريكي)?|USD|\\$|جنيه(?: مصري)?|EGP|ليرة سورية|ليره سورية|SYP|ليرة تركية|TRY|ريال سعودي|SAR|درهم إماراتي|AED|دينار أردني|JOD|يورو|EUR|€';
  const amount = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)';
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}.,])(${amount})[ \t]*(${currencies})(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{N}])(${currencies})[ \t]+(${amount})(?![\\p{N}.,])`, 'giu');
  const matches = [...t.matchAll(pattern)];
  if (matches.length !== 1) return undefined;
  const m = matches[0]; const n = m[1] || m[4], cur = m[2] || m[3];
  // سياقات الكسور أو الأرقام السالبة لا تُقرب ولا تُرحل.
  const before = t.slice(Math.max(0, (m.index || 0) - 1), m.index);
  if (/[-−.٫]/u.test(before)) return undefined;
  const parsed = parseOperationText(`تم قبض ${n} ${cur}`);
  if (!parsed) return undefined;
  const phoneRow = t.split(/\r?\n/).map(x => x.trim().replace(/[ \t()-]/g, '')).find(x => /^0\d{9,14}$/.test(x));
  return { ...parsed, method: /فودافون\s*كاش/iu.test(t) ? 'محفظة' : parsed.method, customer: phoneRow || parsed.customer };
}

/** صيغة إيصال فودافون المؤكّد ذات سطر واحد للمبلغ والعملة، بلا أسئلة أو مبالغ إضافية. */
export function parseConfirmedVodafone(text: string): ParsedOp | undefined {
  const t = (text || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const rows = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (rows.length !== 4 || !/^\d{9,15}$/.test(rows[0]) || !/^فودافون\s+كاش$/iu.test(rows[1]) || !/^(?:✅\s*){2,}$/.test(rows[3])) return undefined;
  const m = rows[2].match(/^(\d{1,9})\s*(جنيه|جنيه مصري|EGP)$/iu);
  const amount = m ? Number(m[1]) : 0;
  if (!Number.isSafeInteger(amount) || amount <= 0) return undefined;
  return { amount, dir: 'in', type: 'تحويل', method: 'محفظة', customer: rows[0], currency: 'EGP' };
}

/* ------------------------- السجل والاستقبال ------------------------- */

const INBOX = 'wa-inbox';
const g = globalThis as unknown as { __amanahInbox?: InboxItem[] };
let LOG: InboxItem[] = (g.__amanahInbox ??= readJson<InboxItem[]>(INBOX, []));

function save() {
  LOG = LOG.slice(0, 5000);
  g.__amanahInbox = LOG;
  writeJson(INBOX, LOG);
}

export function listInbox(): InboxItem[] {
  return LOG;
}

/**
 * يستقبل رسالة واتساب → ينشئ حركة → يرحّلها فورًا إلى الشيت.
 * يعيد بيانات الحركة والسطر، أو سبب الرفض.
 */
export function ingestMessage(input: { text: string; chat: string; fromName?: string; chatName?: string; messageId?: string; messageDate?: string; fromMe?: boolean; mediaType?: string; senderPhone?: string; forceReview?: boolean; pairedOrigin?: boolean }): {
  ok: boolean;
  op?: Operation;
  line?: SheetLine;
  reason?: string;
  sheetId?: string;
  sheetName?: string;
} {
  if (input.messageId && (allOperations().some(x => x.waMessageId === input.messageId && x.chatJid === input.chat) || LOG.some(x => x.messageId === input.messageId && x.chat === input.chat && x.ok))) {
    return { ok: false, reason: 'رسالة سبق التعامل معها' };
  }
  const fromName = input.fromName || input.chat.split('@')[0];
  const isGroup = input.chat.endsWith('@g.us');
  // اسم الشيت: اسم المجموعة، أو اسم المرسل في المحادثة المباشرة
  const sheetName =
    input.chatName?.trim() ||
    (!isGroup && input.fromName && input.fromName !== 'إدخال من الموقع' ? input.fromName : '');
  const sheet = ensureSheetForChat({ jid: input.chat, name: sheetName, date: input.messageDate ? dateInTz(input.messageDate) : undefined });
  const lana = isGroup ? parseLana(input.text) : undefined;
  const parsed = lana || parseOperationText(input.text) || (isGroup ? parseConfirmedVodafone(input.text) || parseAmountCurrency(input.text) : undefined);
  const groupDir = isGroup ? senderDirection(input.senderPhone) : undefined;

  const blocked = postingBlockReason(input.text);
  if (blocked || !parsed || (isGroup && !groupDir)) {
    LOG = [
      {
        at: new Date().toISOString(),
        messageId: input.messageId,
        fromMe: input.fromMe,
        mediaType: input.mediaType,
        chat: input.chat,
        chatName: sheet.name,
        sheetId: sheet.id,
        sheetName: sheet.name,
        fromName,
        text: input.text.slice(0, 400),
        ok: false,
        reason: blocked || (parsed && isGroup && !groupDir ? 'هوية مرسل المجموعة غير مؤكدة؛ لم يُحدد الاتجاه' : 'لم تتوفر صيغة حركة مكتملة وواضحة'),
      },
      ...LOG,
    ];
    save();
    return { ok: false, reason: blocked || (parsed && isGroup && !groupDir ? 'هوية المرسل غير مؤكدة؛ لم تُرحّل' : 'الرسالة ليست بصيغة حركة مالية واضحة أو تحتاج مراجعة') };
  }

  // تشابه القيمة والعملة بين مجموعات يظل احتمال تكرار، لا قراراً آلياً.
  const when = input.messageDate ? Date.parse(input.messageDate) : Date.now();
  const similar = isGroup && allOperations().some(o => o.source === 'whatsapp' && o.chatJid?.endsWith('@g.us') && o.chatJid !== input.chat && o.amount === parsed.amount && o.currency === parsed.currency && Math.abs(Date.parse(o.date) - when) <= 48 * 60 * 60 * 1000);
  const rateMissing = isGroup && !groupPostingAmount(input.chat, parsed.currency, parsed.amount, input.messageDate || '', groupCurrencyMode(input.chat));
  const needsReview = Boolean(input.forceReview || similar || rateMissing);
  const op = createOperation({
    amount: parsed.amount,
    customer: parsed.customer,
    note: input.text.slice(0, 120),
    type: parsed.type,
    method: parsed.method,
    dir: input.pairedOrigin ? 'in' : isGroup && /(?:^|[^\p{L}])لنا(?:$|[^\p{L}])/u.test(input.text) && groupDir ? 'out' : groupDir ?? parsed.dir,
    waSenderPhone: input.senderPhone,
    status: needsReview ? 'review' : 'posted',
    currency: parsed.currency,
    account: ACCOUNT_BY_METHOD[parsed.method] ?? 'الصندوق الرئيسي',
    source: 'whatsapp',
    waText: input.text,
    waFrom: input.chat,
    waMessageId: input.messageId,
    date: input.messageDate,
    fx: input.messageDate ? makeFx(input.chat, parsed.currency, parsed.amount, input.messageDate) : undefined,
    chatJid: input.chat,
    chatName: sheet.name,
  });

  // ترحيل فوري إلى الشيت
  const res = needsReview ? { added: 0, skipped: 0, errors: [] as string[] } : postToSheet([op.id], { sheetId: sheet.id });
  const line = listLines().find((l) => l.opId === op.id);

  LOG = [
    {
      at: new Date().toISOString(),
      messageId: input.messageId,
      fromMe: input.fromMe,
      mediaType: input.mediaType,
      chat: input.chat,
      chatName: sheet.name,
      sheetId: sheet.id,
      sheetName: sheet.name,
      fromName,
      text: input.text.slice(0, 400),
      ok: !needsReview,
      reason: rateMissing ? 'لا يوجد سعر قص سابق واضح لنفس المجموعة والعملة' : needsReview ? 'حركة متشابهة مع مجموعة أخرى — للمراجعة قبل الترحيل' : undefined,
      opId: op.id,
      lineId: line?.id,
      amount: op.amount,
    },
    ...LOG,
  ];
  save();

  return { ok: true, op, line, reason: rateMissing ? 'لا يوجد سعر قص سابق واضح لنفس المجموعة والعملة' : res.errors[0], sheetId: sheet.id, sheetName: sheet.name } as {
    ok: boolean;
    op?: Operation;
    line?: SheetLine;
    reason?: string;
    sheetId?: string;
    sheetName?: string;
  };
}

/** ملخّص للواجهة */
export function inboxStats() {
  return {
    total: LOG.length,
    accepted: LOG.filter((i) => i.ok).length,
    rejected: LOG.filter((i) => !i.ok).length,
    amount: LOG.filter((i) => i.ok).reduce((s, i) => s + (i.amount ?? 0), 0),
  };
}
