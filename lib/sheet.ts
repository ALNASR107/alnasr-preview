/**
 * شيت الترحيل — يحوّل العمليات إلى سطور محاسبية جاهزة للتصدير إلى Excel.
 *
 * الأعمدة (بنفس ترتيب ملفك):
 *   الحساب · البيان · مدين · دائن · العملة · التعادل · المكافآت · مركز التكلفة · التاريخ · المبلغ · الحساب المقابل
 *
 * التخزين: ملف JSON على القرص عبر `lib/store.ts` (`DATA_DIR/sheet-lines.json`)
 * فيبقى الشيت بعد إعادة التشغيل. في الإنتاج، استبدله بجدول `sheet_lines`
 * مع partial unique index على op_id لمنع الترحيل المزدوج.
 */
import type { Operation } from '@/lib/types';
import { allOperations, getOperation, updateStatus } from '@/lib/mock';
import { readJson, writeJson } from '@/lib/store';
import { ensureSheetForChat, MAIN_SHEET_ID } from '@/lib/sheets';
import { dateInTz } from '@/lib/dates';
import { makeFx, groupPostingAmount } from '@/lib/integrations/group-fx';
import { groupCurrencyMode } from '@/lib/integrations/group-rules';

import type { SheetLine } from '@/lib/sheet-shared';
import { COST_CENTERS } from '@/lib/sheet-shared';

export type { SheetLine };
export { COST_CENTERS };

/** خريطة الوسيلة إلى حساب دفتر الأستاذ */
const METHOD_ACCOUNT: Record<string, string> = {
  'بنك': 'المصرف — الحساب الجاري',
  'كاش': 'الصندوق',
  'محفظة': 'محفظة إلكترونية',
  'بطاقة': 'حساب البطاقات',
  'شيك': 'شيكات برسم التحصيل',
};

/** الحساب المقابل حسب نوع العملية واتجاهها */
function counterAccountFor(op: Operation): string {
  if (op.dir === 'in') {
    const map: Record<string, string> = {
      'تحويل': 'إيرادات التحويلات',
      'إيداع': 'إيداعات العملاء',
      'سحب': 'مسحوبات — تسوية',
      'دفع فاتورة': 'مقبوضات فواتير',
      'شحن رصيد': 'إيرادات الشحن',
      'استرداد': 'استردادات',
      'تسوية': 'حساب التسويات',
    };
    return map[op.type] ?? 'إيرادات متنوعة';
  }
  const map: Record<string, string> = {
    'تحويل': 'مدفوعات للموردين',
    'إيداع': 'إيداع لدى الغير',
    'سحب': 'مصروفات نثرية',
    'دفع فاتورة': 'مصروفات فواتير',
    'شحن رصيد': 'مصروف شحن أرصدة',
    'استرداد': 'مردودات',
    'تسوية': 'حساب التسويات',
  };
  return map[op.type] ?? 'مصروفات متنوعة';
}

function defaultCostCenter(op: Operation): string {
  if (op.account.includes('الفرع')) return 'الفرع الرئيسي';
  if (op.dir === 'in') return 'المبيعات';
  return 'العمليات';
}

export function operationToLine(op: Operation, sheetId: string = MAIN_SHEET_ID): SheetLine {
  const isDebit = op.dir === 'in'; // الوارد = مدين على حساب الصندوق/المصرف
  const posting = op.source === 'whatsapp' && op.chatJid?.endsWith('@g.us') ? groupPostingAmount(op.chatJid, op.currency, op.amount, op.date, groupCurrencyMode(op.chatJid)) : { amount: op.amount, currency: op.currency, fx: op.fx };
  if (!posting) throw new Error('لا يوجد سعر قص سابق واضح لنفس المجموعة والعملة');
  return {
    id: 'SL-' + op.id.replace('OP-', ''),
    opId: op.id,
    account: METHOD_ACCOUNT[op.method] ?? op.account,
    statement: op.source === 'whatsapp' && op.waText ? op.waText : `${op.type} — ${op.customer} · ${op.note} (${op.ref})`,
    debit: isDebit ? posting.amount : 0,
    credit: isDebit ? 0 : posting.amount,
    currency: posting.currency,
    balance: 0,
    reward: 0,
    costCenter: defaultCostCenter(op),
    date: dateInTz(op.date),
    amount: posting.amount,
    counterAccount: counterAccountFor(op),
    createdAt: new Date().toISOString(),
    source: op.source,
    fx: posting.fx,
    sheetId,
  };
}

/* ------------------------- المخزن ------------------------- */

const STORE_NAME = 'sheet-lines';

const g = globalThis as unknown as { __amanahSheet?: SheetLine[] };
let LINES: SheetLine[] = (g.__amanahSheet ??= readJson<SheetLine[]>(STORE_NAME, []).map((l) => ({
  ...l,
  sheetId: l.sheetId ?? MAIN_SHEET_ID,
})));

// הסרת סطر אינה מוחקת את العملية; מונעים הוספה מחדש אוטומטית לאחר הסרה ידנית.
const suppressionState = globalThis as unknown as { __nasrSuppressedSheetOps?: string[] };
let suppressed = (suppressionState.__nasrSuppressedSheetOps ??= readJson<string[]>('sheet-suppressed', []));
function saveSuppressed(next: string[]) {
  if (!writeJson('sheet-suppressed', next)) throw new Error('تعذر حفظ منع إعادة الترحيل');
  suppressed = next; suppressionState.__nasrSuppressedSheetOps = next;
}
function persist() {
  g.__amanahSheet = LINES;
  writeJson(STORE_NAME, LINES);
}

/** كل السطور، أو سطور شيت واحد (sheetId غير معطى = الكل) */
export function listLines(sheetId?: string): SheetLine[] {
  if (!sheetId || sheetId === 'all') return LINES;
  return LINES.filter((l) => (l.sheetId ?? MAIN_SHEET_ID) === sheetId);
}

/** ربط نسخة مؤكدة بمجموعة ثانية، دون إنشاء عملية ثانية أو حذف بيانات. */
export function linkGroupMirror(input: { opId:string; originChat:string; targetChat:string; targetName:string; targetDate:string; targetMessageId:string; targetDir:'in'|'out' }): boolean {
  const op = getOperation(input.opId);
  if (!op || op.status !== 'posted' || op.chatJid !== input.originChat || !input.targetChat.endsWith('@g.us') || input.targetChat === input.originChat) return false;
  const primary = LINES.find(l => l.opId === op.id && !l.linkMirror);
  if (!primary) return false;
  const existing = LINES.find(l => l.linkMirror && l.opId === op.id);
  if (existing) return existing.linkedMessageId === input.targetMessageId;
  const posting = groupPostingAmount(input.targetChat, op.currency, op.amount, input.targetDate, groupCurrencyMode(input.targetChat));
  if (!posting) return false;
  const target = ensureSheetForChat({jid:input.targetChat, name:input.targetName, date:dateInTz(input.targetDate)});
  const original = ensureSheetForChat({jid:input.originChat, name:op.chatName, date:dateInTz(op.date)});
  if (primary.sheetId !== original.id) return false;
  const mirror: SheetLine = { ...primary, id:`${primary.id}-linked`, sheetId:target.id, linkedMessageId:input.targetMessageId, linkMirror:true,
    account:target.name, counterAccount:original.name, amount:posting.amount, currency:posting.currency, debit:input.targetDir === 'in' ? posting.amount : 0, credit:input.targetDir === 'out' ? posting.amount : 0,
    date:dateInTz(input.targetDate), fx:posting.fx };
  const changed: SheetLine = { ...primary, counterAccount:target.name };
  const next = [mirror, ...LINES.map(l=>l.id===primary.id ? changed : l)];
  if (!writeJson(STORE_NAME, next)) return false;
  LINES = next; g.__amanahSheet = next;
  return true;
}

/** إحصاء السطور لكل شيت */
export function countsBySheet(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of LINES) {
    const k = l.sheetId ?? MAIN_SHEET_ID;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** مجموع مدين/دائن لكل شيت */
export function totalsBySheet() {
  const out: Record<string, { count: number; debit: number; credit: number }> = {};
  for (const l of LINES) {
    const k = l.sheetId ?? MAIN_SHEET_ID;
    const cur = (out[k] ??= { count: 0, debit: 0, credit: 0 });
    cur.count += 1;
    cur.debit += l.debit;
    cur.credit += l.credit;
  }
  return out;
}

export function totalsOf(lines: SheetLine[]) {
  // عندما يظهر الطرفان في المجموع العام نحتسب العملية مرة واحدة؛ شيت كل طرف يحتفظ بسطره.
  const primaryIds = new Set(lines.filter(l => !l.linkMirror).map(l=>l.opId));
  lines = lines.filter(l=>!l.linkMirror || !primaryIds.has(l.opId));
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  const rowsValid = lines.every((l) => l.balance === 0 && (l.debit > 0) !== (l.credit > 0));

  // المجاميع لكل عملة على حدة (لا يصح جمع الدولار مع الليرة)
  const map = new Map<string, { currency: string; count: number; debit: number; credit: number; net: number }>();
  for (const l of lines) {
    const cur = l.currency || '—';
    const row = map.get(cur) ?? { currency: cur, count: 0, debit: 0, credit: 0, net: 0 };
    row.count += 1;
    row.debit += l.debit;
    row.credit += l.credit;
    row.net = row.debit - row.credit;
    map.set(cur, row);
  }
  const byCurrency = Array.from(map.values()).sort((a, b) => b.count - a.count);

  return {
    count: lines.length,
    debit,
    credit,
    diff: debit - credit,
    balanced: Math.abs(debit - credit) < 0.01,
    rowsValid,
    rewards: lines.reduce((s, l) => s + l.reward, 0),
    byCurrency,
    /** هل الشيت متعدد العملات؟ */
    multiCurrency: byCurrency.length > 1,
  };
}

export function sheetTotals(sheetId?: string) {
  return totalsOf(listLines(sheetId));
}

/**
 * تحويل السطور إلى «قيد مزدوج»: سطران لكل حركة (الحساب + الحساب المقابل)
 * فتصبح مجاميع المدين والدائن متساوية تمامًا — مناسب للمحاسبين ولملف التصدير.
 */
export function expandDouble(lines: SheetLine[]): SheetLine[] {
  const out: SheetLine[] = [];
  for (const l of lines) {
    out.push({ ...l, id: `${l.id}-A`, statement: `${l.statement} · ${l.account}` });
    out.push({
      ...l,
      id: `${l.id}-B`,
      account: l.counterAccount,
      counterAccount: l.account,
      debit: l.credit,
      credit: l.debit,
      balance: 0,
      statement: `${l.statement} · ${l.counterAccount}`,
    });
  }
  return out;
}

/** العمليات المرحّلة التي لم تُضف للشيت بعد (أو لم تُضف إلى شيت محدّد) */
export function pendingForSheet(sheetId?: string): Operation[] {
  const target = sheetId && sheetId !== 'all' ? sheetId : undefined;
  const inSheet = new Set(listLines(target).map((l) => l.opId));
  const all = allOperations().filter((o) => o.status === 'posted' && !inSheet.has(o.id) && !suppressed.includes(o.id));
  if (!target) return all;
  return all.filter((o) => {
    // حركة تنتمي لهذا الشيت: إما محادثتها هي محادثة الشيت، أو شيت افتراضي لحركة بلا محادثة
    return sheetIdForOp(o) === target;
  });
}

/** الشيت الذي تنتمي إليه الحركة (شيت محادثتها في يومها) */
export function sheetIdForOp(op: Operation): string {
  const date = dateInTz(op.date);
  const sheet = ensureSheetForChat({ jid: op.chatJid ?? '', name: op.chatName, date });
  return sheet.id;
}

export function postToSheet(
  ids: string[],
  opts?: { costCenter?: string; sheetId?: string },
): { added: number; skipped: number; errors: string[] } {
  const existing = new Set(LINES.map((l) => l.opId));
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const id of ids) {
    if (existing.has(id)) {
      skipped += 1;
      continue;
    }
    const op = getOperation(id);
    if (!op) {
      errors.push(`${id}: غير موجودة`);
      continue;
    }

    // الشيت: المحدّد صريحًا، وإلا شيت محادثة واتساب، وإلا الشيت الرئيسي
    const sheetId = opts?.sheetId && opts.sheetId !== 'all' ? opts.sheetId : sheetIdForOp(op);
    let line: SheetLine;
    try { line = operationToLine(op, sheetId); } catch (err) { errors.push(`${id}: ${(err as Error).message}`); continue; }
    if (op.status !== 'posted') updateStatus(id, 'posted');
    if (opts?.costCenter) line.costCenter = opts.costCenter;
    LINES = [line, ...LINES];
    if (suppressed.includes(id)) saveSuppressed(suppressed.filter(x=>x!==id));
    existing.add(id);
    added += 1;
  }

  persist();
  return { added, skipped, errors };
}

/** ترحيل كل العمليات المرحّلة غير المدرجة في الشيت */
export function postAllPending(opts?: { costCenter?: string; sheetId?: string }) {
  return postToSheet(pendingForSheet(opts?.sheetId).map((o) => o.id), opts);
}

export function updateLine(id: string, patch: Partial<Pick<SheetLine, 'costCenter' | 'counterAccount' | 'reward' | 'debit' | 'credit' | 'statement'>>) {
  const line = LINES.find((l) => l.id === id);
  if (!line) return undefined;
  Object.assign(line, patch);
  line.balance = line.amount - (line.debit + line.credit);
  persist();
  return line;
}

/** حذف كل سطور شيت (أو الكل) */
export function clearLines(sheetId?: string) {
  const before = LINES.length;
  if (!sheetId || sheetId === 'all') LINES = [];
  else LINES = LINES.filter((l) => (l.sheetId ?? MAIN_SHEET_ID) !== sheetId);
  persist();
  return before - LINES.length;
}

/** حذف سطر واحد فقط دون حذف العملية أو رسالة واتساب، مع منع إعادة إضافته تلقائياً. */
export function removeLineAndSuppress(id:string): number {
  const line = LINES.find(x=>x.id===id);
  if (!line) return 0;
  if (!suppressed.includes(line.opId)) saveSuppressed([...suppressed,line.opId]);
  const next = LINES.filter(x=>x.id!==id);
  if (!writeJson(STORE_NAME,next)) throw new Error('تعذر حفظ حذف السطر');
  LINES = next; g.__amanahSheet = next;
  return 1;
}

export function removeLines(ids: string[]) {
  const set = new Set(ids);
  const before = LINES.length;
  LINES = LINES.filter((l) => !set.has(l.id));
  persist();
  return before - LINES.length;
}
