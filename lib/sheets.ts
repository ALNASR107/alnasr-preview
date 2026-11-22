/**
 * سجل الشيتات: لكل محادثة أو مجموعة واتساب شيت مستقل.
 *
 * - `main` شيت افتراضي لأي حركة لا تنتمي لمحادثة واتساب (أوامر النظام، إدخال يدوي).
 * - شيت المحادثة/المجموعة يُنشأ تلقائيًا عند وصول أول حركة منها.
 * - السجل يُحفظ في `DATA_DIR/sheets.json`، والسطور في `sheet-lines.json` مع `sheetId`.
 */
import { readJson, writeJson } from '@/lib/store';
import { todayInTz } from '@/lib/dates';

export type SheetKind = 'main' | 'chat' | 'group' | 'manual';

export type Sheet = {
  id: string;
  name: string;
  kind: SheetKind;
  /** JID واتساب (للمحادثات والمجموعات) */
  jid?: string;
  /** اليوم الذي يخصّه الشيت (YYYY-MM-DD) — شيت لكل يوم */
  date?: string;
  createdAt: string;
  /** أُنشئ تلقائيًا من رسالة واتساب */
  auto?: boolean;
};

export const MAIN_SHEET_ID = 'main';
const STORE = 'sheets';

const g = globalThis as unknown as { __amanahSheets?: Sheet[] };

/** الشيت الرئيسي صار لكل يوم: main--YYYY-MM-DD (يبقى `main` للتوافق مع القديم) */
export function mainSheetId(date: string = todayInTz()) {
  return `${MAIN_SHEET_ID}--${date}`;
}

const DEFAULT_MAIN: Sheet = {
  id: MAIN_SHEET_ID,
  name: 'الشيت الرئيسي',
  kind: 'main',
  createdAt: new Date().toISOString(),
};

let SHEETS: Sheet[] = (g.__amanahSheets ??= normalize(readJson<Sheet[]>(STORE, [])));

function normalize(list: Sheet[]): Sheet[] {
  const clean = Array.isArray(list) ? list.filter((s) => s && s.id) : [];
  if (!clean.some((s) => s.id === MAIN_SHEET_ID)) clean.unshift({ ...DEFAULT_MAIN });
  return clean;
}

function persist() {
  g.__amanahSheets = SHEETS;
  writeJson(STORE, SHEETS);
}

/** كل الشيتات، أو شيتات يوم محدّد */
export function listSheets(date?: string): Sheet[] {
  if (!date) return SHEETS;
  return SHEETS.filter((s) => (s.date ?? '') === date);
}

/** الأيام التي لها شيتات (الأحدث أولًا) */
export function listDays(): string[] {
  const set = new Set<string>();
  for (const s of SHEETS) if (s.date) set.add(s.date);
  return Array.from(set).sort().reverse();
}

export function getSheet(id: string): Sheet | undefined {
  return SHEETS.find((s) => s.id === id);
}

/** معرّف آمن من JID: chat-9639… / group-1203630… */
function idFromJid(jid: string): string {
  const digits = jid.split('@')[0].replace(/[^\d]/g, '');
  return `${jid.endsWith('@g.us') ? 'group' : 'chat'}-${digits}`;
}

/**
 * يعيد شيت المحادثة/المجموعة، وينشئه إن لم يكن موجودًا.
 * الاسم يُحدَّث تلقائيًا إن تغيّر (مثلًا تغيّر اسم المجموعة).
 */
export function ensureSheetForChat(input: { jid: string; name?: string; date?: string }): Sheet {
  const jid = input.jid;
  const date = input.date || todayInTz();

  // بلا محادثة → الشيت الرئيسي لليوم نفسه
  if (!jid || jid === 'web@local') {
    return ensureMainSheet(date);
  }

  const id = `${idFromJid(jid)}--${date}`;
  const isGroup = jid.endsWith('@g.us');
  const fallback = isGroup ? `مجموعة ${jid.split('@')[0]}` : `محادثة ${jid.split('@')[0]}`;
  const name = (input.name || '').trim() || fallback;

  const found = SHEETS.find((s) => s.id === id);
  if (found) {
    if (found.name !== name && found.auto) {
      found.name = name;
      persist();
    }
    return found;
  }

  const sheet: Sheet = {
    id,
    name,
    kind: isGroup ? 'group' : 'chat',
    jid,
    date,
    createdAt: new Date().toISOString(),
    auto: true,
  };
  SHEETS = [...SHEETS, sheet];
  persist();
  return sheet;
}

/** الشيت الرئيسي لليوم (يُنشأ عند الحاجة) */
export function ensureMainSheet(date: string = todayInTz()): Sheet {
  const id = mainSheetId(date);
  const found = SHEETS.find((s) => s.id === id);
  if (found) return found;
  const sheet: Sheet = {
    id,
    name: 'الشيت الرئيسي',
    kind: 'main',
    date,
    createdAt: new Date().toISOString(),
  };
  SHEETS = [...SHEETS, sheet];
  persist();
  return sheet;
}

export function createSheet(name: string, date: string = todayInTz()): Sheet {
  const clean = name.trim() || 'شيت جديد';
  let i = 1;
  let id = `manual-${Date.now()}`;
  while (SHEETS.some((s) => s.id === id)) id = `manual-${Date.now()}-${i++}`;
  const sheet: Sheet = { id, name: clean, kind: 'manual', date, createdAt: new Date().toISOString() };
  SHEETS = [...SHEETS, sheet];
  persist();
  return sheet;
}

export function renameSheet(id: string, name: string): Sheet | undefined {
  const s = SHEETS.find((x) => x.id === id);
  if (!s || !name.trim()) return undefined;
  s.name = name.trim();
  s.auto = false; // اسم اختاره المستخدم — لا نُبدّله تلقائيًا بعد الآن
  persist();
  return s;
}

export function removeSheet(id: string): boolean {
  if (id === MAIN_SHEET_ID || /^main--/.test(id)) return false;
  const before = SHEETS.length;
  SHEETS = SHEETS.filter((s) => s.id !== id);
  persist();
  return SHEETS.length < before;
}
