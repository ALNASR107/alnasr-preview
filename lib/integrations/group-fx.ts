/** أسعار قص العملات لكل مجموعة. الأسعار تحفظ بوقت الرسالة وليس وقت استقبالها. */
import { readJson, writeJson } from '@/lib/store';
export type GroupRate = { chat: string; currency: string; rate: number; at: string; messageId: string };
const g = globalThis as unknown as { __nasrGroupRates?: GroupRate[] };
let rates = (g.__nasrGroupRates ??= readJson<GroupRate[]>('wa-group-rates', []));
const currencies: Record<string, string> = {
  'الجنيه': 'EGP', 'جنيه': 'EGP', 'جنيه مصري': 'EGP', 'egp': 'EGP',
  'الليرة السورية': 'SYP', 'ليرة سورية': 'SYP', 'syp': 'SYP',
  'الليرة التركية': 'TRY', 'ليرة تركية': 'TRY', 'try': 'TRY',
  'الريال السعودي': 'SAR', 'ريال سعودي': 'SAR', 'sar': 'SAR',
  'الدرهم الإماراتي': 'AED', 'درهم إماراتي': 'AED', 'aed': 'AED',
  'الدينار الأردني': 'JOD', 'دينار أردني': 'JOD', 'jod': 'JOD',
  'اليورو': 'EUR', 'يورو': 'EUR', 'eur': 'EUR',
};
export function parseRateBulletin(text: string) {
  const normalized = text.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/٫/g, '.');
  const found: { currency: string; rate: number }[] = [];
  for (const line of normalized.split(/\r?\n/)) {
    const m = line.trim().match(/^(?:نشرة\s*[:：-]?\s*)?سعر\s+قص\s+(الجنيه|جنيه مصري|جنيه|EGP|الليرة السورية|ليرة سورية|SYP|الليرة التركية|ليرة تركية|TRY|الريال السعودي|ريال سعودي|SAR|الدرهم الإماراتي|درهم إماراتي|AED|الدينار الأردني|دينار أردني|JOD|اليورو|يورو|EUR)\s*[:：=]?\s*(\d+(?:\.\d{1,6})?)\s*$/iu);
    if (!m) continue;
    const rate = Number(m[2]), currency = currencies[m[1].toLowerCase()];
    if (currency && Number.isFinite(rate) && rate > 0 && rate <= 1e9) found.push({ currency, rate });
  }
  // صيغة النشرة التي أكدها المستخدم: فودافون <سعر> بدون أجور.
  // لا نستعمل «عكسي» ولا أسعار الإنستا، ولا نخمّن من سطر ملتبس.
  for (const line of normalized.split(/\r?\n/)) {
    const clean = line.replace(/[\u200e\u200f\u061c]/g, '').replace(/[✅*\uFE0F\u200D]/gu, '').trim();
    const m = clean.match(/^فودافون\s*[:：=]?\s*(\d+(?:\.\d{1,6})?)\s*بدون\s+[اأ]جور$/u);
    if (!m) continue;
    const rate = Number(m[1]);
    if (Number.isFinite(rate) && rate > 0 && rate <= 1e9) found.push({ currency:'EGP', rate });
  }
  // أسعار متضاربة لنفس العملة في رسالة واحدة غير آمنة.
  return found.filter(x => found.filter(y => y.currency === x.currency).length === 1);
}
export function recordBulletin(input: { chat: string; text: string; messageId: string; at: string }) {
  if (!input.chat.endsWith('@g.us') || !input.messageId || !Number.isFinite(Date.parse(input.at))) return 0;
  const parsed = parseRateBulletin(input.text);
  let added = 0;
  for (const p of parsed) {
    if (rates.some(r => r.chat === input.chat && r.messageId === input.messageId && r.currency === p.currency)) continue;
    rates.push({ chat: input.chat, messageId: input.messageId, at: input.at, ...p }); added++;
  }
  if (added) { g.__nasrGroupRates = rates; if (!writeJson('wa-group-rates', rates)) throw new Error('تعذر حفظ سعر القص'); }
  return added;
}
export function rateAt(chat: string, currency: string, at: string) {
  const when = Date.parse(at);
  if (!chat.endsWith('@g.us') || !Number.isFinite(when)) return undefined;
  // لا نخمن ترتيب رسالتين لهما نفس الثانية.
  const prior = rates.filter(r => r.chat === chat && r.currency === currency && Date.parse(r.at) < when).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (prior.length > 1 && prior[0].at === prior[1].at && prior[0].rate !== prior[1].rate) return undefined;
  return prior[0];
}
export function makeFx(chat: string, currency: string, amount: number, at: string) {
  const r = rateAt(chat, currency, at);
  if (!r) return undefined;
  const usd = Math.round((amount / r.rate + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(usd) || !Number.isSafeInteger(Math.round(usd * 100))) return undefined;
  return { rate: r.rate, usd, at: r.at, messageId: r.messageId };
}
export function currentGroupRates() {
  const latest = new Map<string, GroupRate>();
  for (const r of rates) { const key = `${r.chat}|${r.currency}`; const old = latest.get(key); if (!old || Date.parse(r.at) > Date.parse(old.at)) latest.set(key, r); }
  return [...latest.values()];
}

/** تحضير مبلغ القيد لعملة المجموعة، دون تعديل الأصل المحفوظ بالعملية. */
export function groupPostingAmount(chat: string, currency: string, amount: number, at: string, mode: 'original' | 'usd') {
  if (mode !== 'usd' || currency === 'USD') return { amount, currency, fx: currency === 'USD' ? undefined : makeFx(chat, currency, amount, at) };
  const fx = makeFx(chat, currency, amount, at);
  if (!fx || fx.usd <= 0) return undefined;
  return { amount: fx.usd, currency: 'USD', fx };
}
