/**
 * تكامل «وكيد» (wakeed.online) — نظام ERP محاسبي سحابي يوفّر API + Webhook.
 *
 * وكيد لا ينشر توثيقًا عامًا؛ تحصل على بيانات الربط من فريقهم:
 *   WAKEED_BASE_URL=https://api.wakeed.online/v1   // تُؤكَّد من الدعم
 *   WAKEED_API_KEY=...                              // مفتاح الحساب/الشركة
 *   WAKEED_WEBHOOK_SECRET=...                       // للتحقق من Webhook الوارد
 *
 * المسارات أدناه معزولة في دوال صغيرة، فإذا اختلفت أسماء الحقول عند وكيد
 * يكفي تعديل `mapOperationToWakeedInvoice` ومسارات `ENDPOINTS` — دون لمس باقي التطبيق.
 */
import type { Operation } from '@/lib/types';

const ENDPOINTS = {
  invoices: process.env.WAKEED_INVOICE_PATH ?? '/invoices', // فاتورة مبيعات/مشتريات
  journal: process.env.WAKEED_JOURNAL_PATH ?? '/journal-entries',
  ping: process.env.WAKEED_PING_PATH ?? '/me',
};

export function wakeedConfigured(): boolean {
  return Boolean(process.env.WAKEED_BASE_URL && process.env.WAKEED_API_KEY);
}

export type WakeedInvoice = {
  external_id: string; // مفتاح منع التكرار — نستخدم رقم العملية
  type: 'sales_invoice' | 'purchase_invoice';
  date: string;
  currency: string;
  customer: { name: string; phone?: string };
  reference?: string;
  account_name?: string;
  lines: { description: string; quantity: number; unit_price: number; tax_rate: number }[];
  notes?: string;
  source: 'amanah';
};

/** تحويل عملية أمانة إلى فاتورة وكيد — هذا هو «عقد» الربط الوحيد */
export function mapOperationToWakeedInvoice(op: Operation): WakeedInvoice {
  return {
    external_id: op.id,
    type: op.dir === 'in' ? 'sales_invoice' : 'purchase_invoice',
    date: op.date.slice(0, 10),
    currency: op.currency,
    customer: { name: op.customer },
    reference: op.ref,
    account_name: op.account,
    lines: [
      {
        description: `${op.type} — ${op.note}`,
        quantity: 1,
        unit_price: op.amount,
        tax_rate: 0,
      },
    ],
    notes: `أُنشئت من شركة النصر · ${op.id}`,
    source: 'amanah',
  };
}

type PushResult<T> = { ok: boolean; skipped?: boolean; status?: number; data?: T; error?: string };

async function request<T>(path: string, init?: RequestInit): Promise<PushResult<T>> {
  if (!wakeedConfigured()) return { ok: true, skipped: true };

  try {
    const res = await fetch(`${process.env.WAKEED_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.WAKEED_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => undefined)) as T;
    if (!res.ok) {
      return { ok: false, status: res.status, error: `وكيد أعاد ${res.status}`, data };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** دفع عملية مرحّلة إلى وكيد كفاتورة */
export function pushOperationToWakeed(op: Operation) {
  return request(ENDPOINTS.invoices, {
    method: 'POST',
    body: JSON.stringify(mapOperationToWakeedInvoice(op)),
  });
}

/** قيد يومية بديل (إن أراد المحاسب قيدًا بدل فاتورة) */
export function pushJournalEntry(op: Operation) {
  const inv = mapOperationToWakeedInvoice(op);
  return request(ENDPOINTS.journal, {
    method: 'POST',
    body: JSON.stringify({
      external_id: inv.external_id,
      date: inv.date,
      description: `${op.type} — ${op.note}`,
      debit_account: op.dir === 'in' ? op.account : op.customer,
      credit_account: op.dir === 'in' ? op.customer : op.account,
      amount: op.amount,
      currency: op.currency,
      source: 'amanah',
    }),
  });
}

/** اختبار الاتصال: هل المفتاح صالح؟ */
export function pingWakeed() {
  return request<{ company?: string; name?: string }>(ENDPOINTS.ping, { method: 'GET' });
}

/** التحقق من توقيع Webhook الوارد من وكيد (إن وفّروا HMAC) */
export async function verifyWakeedSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = process.env.WAKEED_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha256=/, ''));
  return a.length === b.length && timingSafeEqual(a, b);
}
