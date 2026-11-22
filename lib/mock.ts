/**
 * بيانات تجريبية (Mock) — موجودة على الخادم فقط.
 * استبدلها بمصدرك الحقيقي (قاعدة بيانات / API خارجي) داخل lib/db.ts أو داخل route handlers.
 */
import { readJson, writeJson } from '@/lib/store';
import type {
  Direction,
  Kpis,
  Operation,
  OperationStatus,
  OperationsQuery,
  SortDir,
} from '@/lib/types';

const CURRENCY = 'ل.س';

let seed = 20261120;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const rint = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const TYPES = ['تحويل', 'إيداع', 'سحب', 'دفع فاتورة', 'شحن رصيد', 'استرداد', 'تسوية'];
const METHODS = ['بنك', 'كاش', 'محفظة', 'بطاقة', 'شيك'];
const CUSTOMERS = [
  'شركة النور للتجارة', 'مؤسسة الجبل للإنشاءات', 'سامر خليل', 'رنا الحلبي',
  'شركة الشام للشحن', 'مخبز السنابل', 'صيدلية السلام', 'عمر عبد الرحمن',
  'شركة التقنية الحديثة', 'ليلى حيدر', 'مؤسسة الوفاء', 'حسّان المصري',
  'مكتب الرياض للمحاسبة', 'نور الدين قاسم', 'شركة الأفق للتأمين',
  'متجر النخبة', 'زينة الأحمد', 'شركة البناء المتحدة', 'عيادة الرازي', 'أحمد الجندي',
];
const NOTES: Record<string, string[]> = {
  'تحويل': ['تحويل دفعة موردين', 'تحويل أرباح شهرية', 'تحويل مقابل خدمات استشارية', 'تحويل مستحقات عقد'],
  'إيداع': ['إيداع نقدي في الصندوق', 'إيداع شيك وارد', 'إيداع تحصيل من عميل'],
  'سحب': ['سحب مصاريف تشغيلية', 'سحب رواتب', 'سحب سلفة'],
  'دفع فاتورة': ['تسديد فاتورة كهرباء', 'دفع فاتورة اتصالات', 'تسديد فاتورة إيجار'],
  'شحن رصيد': ['شحن محفظة وكيل', 'شحن رصيد محفظة الثقة'],
  'استرداد': ['استرداد مبلغ عملية ملغاة', 'إرجاع دفعة زائدة'],
  'تسوية': ['تسوية فروقات صندوق', 'تسوية حساب بنكي شهري'],
};

function buildOps(n: number): Operation[] {
  const now = new Date();
  const out: Operation[] = [];
  for (let i = 0; i < n; i++) {
    const daysBack = Math.floor(Math.pow(rnd(), 1.35) * 60);
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    d.setHours(rint(8, 20), rint(0, 59), rint(0, 59), 0);

    const type = pick(TYPES);
    const method = pick(METHODS);
    const dir: Direction = rnd() < 0.53 ? 'in' : 'out';

    let status: OperationStatus;
    const r = rnd();
    if (daysBack > 3) {
      status = r < 0.885 ? 'posted' : r < 0.925 ? 'ignored' : r < 0.955 ? 'duplicate' : r < 0.978 ? 'failed' : 'review';
    } else {
      status = r < 0.55 ? 'posted' : r < 0.76 ? 'review' : r < 0.89 ? 'pending' : r < 0.945 ? 'failed' : r < 0.975 ? 'duplicate' : 'ignored';
    }

    const base = rnd();
    const amount = Math.round((150000 + base * base * 9200000) / 500) * 500;

    out.push({
      id: 'OP-' + (24500 + n - i),
      date: d.toISOString(),
      customer: pick(CUSTOMERS),
      note: pick(NOTES[type] ?? ['عملية مالية']),
      type,
      method,
      dir,
      status,
      amount,
      currency: CURRENCY,
      ref: 'INV-' + rint(10000, 99999),
      account: pick(['الصندوق الرئيسي', 'حساب المصرف التجاري', 'محفظة الثقة', 'صندوق الفرع الثاني']),
      user: pick(['محمد الأحمد', 'رهف العلي', 'خالد درويش', 'سلام النجار']),
    });
  }
  return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/**
 * الحركات المضافة من واتساب تُحفظ على القرص (`DATA_DIR/wa-operations.json`)
 * حتى لا تُفقد عند إعادة التشغيل، وتُدمج مع البيانات التجريبية.
 */
type OpStore = { seq: number; ops: Operation[] };
const WA_STORE = 'wa-operations';
const waStore: OpStore = readJson<OpStore>(WA_STORE, { seq: 90000, ops: [] });

/** مخزن في الذاكرة — البيانات التجريبية تُعاد توليدها عند التشغيل، والواردة من واتساب تُقرأ من القرص */
/**
 * عدد الحركات التجريبية — اضبط DEMO_OPS=0 لبدء نظام فارغ (حركات واتساب فقط).
 * الافتراضي 148 للتجربة.
 */
const DEMO_OPS = (() => {
  const n = Number(process.env.DEMO_OPS ?? 148);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 2000) : 148;
})();

let OPS: Operation[] = [...waStore.ops, ...buildOps(DEMO_OPS)].sort((a, b) => +new Date(b.date) - +new Date(a.date));

export function allOperations(): Operation[] {
  return OPS;
}

/** إنشاء حركة جديدة (تُستخدم لرسائل واتساب والاستيراد) */
export function createOperation(input: {
  amount: number;
  customer?: string;
  note?: string;
  type?: string;
  method?: string;
  dir?: Direction;
  status?: OperationStatus;
  currency?: string;
  account?: string;
  user?: string;
  source?: 'whatsapp' | 'manual';
  waText?: string;
  waFrom?: string;
  waMessageId?: string;
  waSenderPhone?: string;
  fx?: Operation['fx'];
  date?: string;
  chatJid?: string;
  chatName?: string;
}): Operation {
  waStore.seq += 1;
  let newId = 'OP-' + waStore.seq;
  // ضمان عدم تكرار المعرّف (قد تكون هناك سطور شيت قديمة بنفس الرقم)
  while (OPS.some((o) => o.id === newId)) {
    waStore.seq += 1;
    newId = 'OP-' + waStore.seq;
  }
  const op: Operation = {
    id: newId,
    date: input.date || new Date().toISOString(),
    customer: input.customer?.trim() || 'مرسل عبر واتساب',
    note: input.note?.trim() || 'حركة واردة من واتساب',
    type: input.type || 'تحويل',
    method: input.method || 'كاش',
    dir: input.dir || 'in',
    status: input.status || 'posted',
    amount: Math.round((input.amount + Number.EPSILON) * 100) / 100,
    currency: input.currency || CURRENCY,
    ref: 'WA-' + String(waStore.seq).slice(-6),
    account: input.account || 'الصندوق الرئيسي',
    user: input.user || 'مستخدم واتساب',
    source: input.source || 'whatsapp',
    waText: input.waText,
    waFrom: input.waFrom,
    waMessageId: input.waMessageId,
    waSenderPhone: input.waSenderPhone,
    fx: input.fx,
    chatJid: input.chatJid,
    chatName: input.chatName,
  };

  waStore.ops = [op, ...waStore.ops].slice(0, 5000);
  writeJson(WA_STORE, waStore);
  OPS = [op, ...OPS];
  return op;
}

export function getOperation(id: string): Operation | undefined {
  return OPS.find((o) => o.id === id);
}

export function updateStatus(id: string, status: OperationStatus): Operation | undefined {
  const op = OPS.find((o) => o.id === id);
  if (!op) return undefined;
  op.status = status;
  if (waStore.ops.some(o => o.id === op.id)) writeJson(WA_STORE, waStore);
  return op;
}

/* ------------------------- الفلترة والترتيب ------------------------- */

export function filterOperations(ops: Operation[], q: OperationsQuery): Operation[] {
  const term = (q.q ?? '').trim().toLowerCase();
  const statuses = q.status?.filter(Boolean) ?? [];

  return ops.filter((o) => {
    if (statuses.length && !statuses.includes(o.status)) return false;
    if (q.type && o.type !== q.type) return false;
    if (q.method && o.method !== q.method) return false;
    if (q.dir && o.dir !== q.dir) return false;
    const day = o.date.slice(0, 10);
    if (q.from && day < q.from) return false;
    if (q.to && day > q.to) return false;
    if (term) {
      const hay = `${o.id} ${o.customer} ${o.note} ${o.ref} ${o.type} ${o.amount}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

export function sortOperations(rows: Operation[], key = 'date', order: SortDir = 'desc'): Operation[] {
  const mul = order === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let A: number | string = (a as never)[key as never];
    let B: number | string = (b as never)[key as never];
    if (key === 'date') {
      A = +new Date(a.date);
      B = +new Date(b.date);
    }
    return A > B ? mul : A < B ? -mul : 0;
  });
}

/* ------------------------- المؤشرات ------------------------- */

export function computeKpis(rows: Operation[]): Kpis {
  const sumIn = rows.filter((o) => o.dir === 'in' && o.status !== 'failed').reduce((s, o) => s + o.amount, 0);
  const sumOut = rows.filter((o) => o.dir === 'out' && o.status !== 'failed').reduce((s, o) => s + o.amount, 0);
  const pending = rows.filter((o) => o.status === 'pending').length;
  const needsAction = rows.filter((o) => o.status === 'review' || o.status === 'pending').length;
  const postedCount = rows.filter((o) => o.status === 'posted').length;
  return {
    sumIn,
    sumOut,
    net: sumIn - sumOut,
    needsAction,
    pending,
    postedCount,
    postRate: rows.length ? Math.round((postedCount / rows.length) * 100) : 0,
    total: rows.length,
  };
}

export function statusCounts(rows: Operation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  rows.forEach((o) => (counts[o.status] = (counts[o.status] ?? 0) + 1));
  return counts;
}

/** سلسلة زمنية لآخر n يومًا (للرسوم البيانية) */
export function dailySeries(ops: Operation[], days = 14) {
  const now = new Date();
  const keys: string[] = [];
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }
  const bucketIn = new Map(keys.map((k) => [k, 0]));
  const bucketOut = new Map(keys.map((k) => [k, 0]));
  ops.forEach((o) => {
    const k = o.date.slice(0, 10);
    if (!bucketIn.has(k)) return;
    if (o.status === 'failed' || o.status === 'ignored') return;
    if (o.dir === 'in') bucketIn.set(k, (bucketIn.get(k) ?? 0) + o.amount);
    else bucketOut.set(k, (bucketOut.get(k) ?? 0) + o.amount);
  });
  return {
    labels,
    in: keys.map((k) => bucketIn.get(k) ?? 0),
    out: keys.map((k) => bucketOut.get(k) ?? 0),
  };
}
