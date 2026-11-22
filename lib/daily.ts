/**
 * ملخّص اليوم: مجاميع الحركات ليوم واحد، لكل عملة ولكل شيت (محادثة/مجموعة),
 * مع إرساله تلقائيًا عبر واتساب في نهاية اليوم.
 *
 * متغيرات البيئة:
 *   DAILY_REPORT_ENABLED=1     تشغيل/إيقاف الملخّص اليومي
 *   DAILY_REPORT_AT=23:50      وقت الإرسال بتوقيت APP_TZ
 *   WA_DAILY_REPORT_TO=…       رقم/مجموعة الملخّص (وإلا WA_AUTO_SUMMARY_TO)
 */
import { listLines, totalsOf } from '@/lib/sheet';
import { listSheets } from '@/lib/sheets';
import { todayInTz, prettyDate, timeInTz, shiftDate } from '@/lib/dates';
import { readJson, writeJson } from '@/lib/store';
import { sendWaWebText, waWebConnected } from '@/lib/integrations/wa-web';
import { logEvent } from '@/lib/integrations/log';

const n = (v: number) => v.toLocaleString('en-US');

export type CurrencyTotal = { currency: string; count: number; debit: number; credit: number; net: number };

export function dayReport(date: string = todayInTz()) {
  const lines = listLines().filter((l) => l.date === date);
  const totals = totalsOf(lines);

  const sheets = listSheets(date).map((s) => {
    const own = lines.filter((l) => l.sheetId === s.id);
    const t = totalsOf(own);
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      count: own.length,
      byCurrency: t.byCurrency as CurrencyTotal[],
    };
  });

  // شيتات قديمة بلا تاريخ (قبل التحديث) تُحسب في اليوم المطلوب إن كانت سطورها به
  const orphan = lines.filter((l) => !listSheets(date).some((s) => s.id === l.sheetId));
  if (orphan.length) {
    const t = totalsOf(orphan);
    sheets.push({ id: 'other', name: 'شيتات أخرى', kind: 'manual', count: orphan.length, byCurrency: t.byCurrency });
  }

  return {
    date,
    label: prettyDate(date),
    count: totals.count,
    byCurrency: totals.byCurrency as CurrencyTotal[],
    sheets: sheets.filter((s) => s.count > 0),
    rewards: totals.rewards,
  };
}

/** ملخّص كل الأيام مجتمعة (للاطّلاع السريع) */
export function allReport() {
  const lines = listLines();
  const totals = totalsOf(lines);
  const allSheets = listSheets();
  const sheets = allSheets
    .map((s) => {
      const own = lines.filter((l) => l.sheetId === s.id);
      const t = totalsOf(own);
      return { id: s.id, name: s.name, kind: s.kind, count: own.length, byCurrency: t.byCurrency as CurrencyTotal[] };
    })
    .filter((s) => s.count > 0);
  const known = new Set(allSheets.map((s) => s.id));

  const orphan = lines.filter((l) => !known.has(l.sheetId || ''));
  if (orphan.length) {
    const t = totalsOf(orphan);
    sheets.push({ id: 'other', name: 'شيتات أخرى', kind: 'manual', count: orphan.length, byCurrency: t.byCurrency });
  }
  return {
    date: 'all',
    label: 'كل الأيام',
    count: totals.count,
    byCurrency: totals.byCurrency as CurrencyTotal[],
    sheets,
    rewards: totals.rewards,
  };
}

/** نص رسالة ملخّص اليوم */
export function buildDailyMessage(date: string = todayInTz()) {
  const r = dayReport(date);
  const head = `📅 *ملخّص ${r.label}* (${r.date})\n• عدد الحركات: ${n(r.count)}\n`;

  const cur = r.byCurrency.length
    ? r.byCurrency
        .map((c) => `• ${c.currency}: مدين ${n(c.debit)} · دائن ${n(c.credit)} · الصافي ${n(c.net)}`)
        .join('\n')
    : '• لا حركات في هذا اليوم';

  const perSheet = r.sheets.length
    ? '\n\n*حسب المحادثات والمجموعات:*\n' +
      r.sheets
        .slice(0, 20)
        .map((s) => {
          const money = s.byCurrency.map((c) => `${c.currency} ${n(c.debit - c.credit)}`).join(' · ');
          return `• ${s.name}: ${n(s.count)} حركة · صافي ${money || '0'}`;
        })
        .join('\n')
    : '';

  const tail = r.rewards ? `\n\n🎁 مجموع المكافآت: ${n(r.rewards)}` : '';
  return `${head}${cur}${perSheet}${tail}`;
}

/** إرسال ملخّص يوم إلى رقم/مجموعة */
export async function sendDailyReport(opts?: { date?: string; to?: string }) {
  const date = opts?.date ?? todayInTz();
  const to = opts?.to || process.env.WA_DAILY_REPORT_TO || process.env.WA_AUTO_SUMMARY_TO || '';
  if (!to) return { ok: false, error: 'لا يوجد رقم/مجموعة للملخّص (WA_DAILY_REPORT_TO)' };
  if (!waWebConnected()) return { ok: false, error: 'واتساب غير مرتبط' };

  const text = buildDailyMessage(date);
  const res = await sendWaWebText(to, text);
  if (res.ok) logEvent({ ch: 'whatsapp', ok: true, msg: `أُرسل ملخّص ${date} إلى ${to}` });
  return { ...res, to, date, chars: text.length };
}

/* ------------------- الإرسال التلقائي نهاية اليوم ------------------- */

const STATE = 'daily-report-state';
type State = { lastSent?: string };
const g = globalThis as unknown as { __amanahDailyState?: State };
let state: State = (g.__amanahDailyState ??= readJson<State>(STATE, {}));

export function dailyReportEnabled() {
  // المستخدم طلب عدم إرسال أي رسالة لأي جهة.
  return false;
}

/** يُستدعى دوريًا: يرسل ملخّص اليوم مرة واحدة بعد الوقت المحدد */
export async function maybeSendDailyReport() {
  if (!dailyReportEnabled()) return { sent: false, reason: 'الملخّص اليومي معطّل' };
  const at = process.env.DAILY_REPORT_AT || '23:50';
  const today = todayInTz();
  if (state.lastSent === today) return { sent: false, reason: 'أُرسل اليوم' };
  if (timeInTz() < at) return { sent: false, reason: `لم يحن الوقت (${at})` };

  const res = await sendDailyReport({ date: today });
  if (res.ok && 'to' in res) {
    state = { lastSent: today };
    g.__amanahDailyState = state;
    writeJson(STATE, state);
    return { sent: true, to: res.to };
  }
  return { sent: false, reason: 'error' in res ? res.error : 'فشل' };
}

export function dailyReportState() {
  return {
    enabled: dailyReportEnabled(),
    at: process.env.DAILY_REPORT_AT || '23:50',
    lastSent: state.lastSent ?? null,
    today: todayInTz(),
    to:
      process.env.WA_DAILY_REPORT_TO || process.env.WA_AUTO_SUMMARY_TO
        ? 'مضبوط'
        : 'غير مضبوط',
    yesterday: shiftDate(todayInTz(), -1),
  };
}
