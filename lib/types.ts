/** أنواع البيانات المشتركة بين الخادم والعميل */

export type OperationStatus =
  | 'posted'
  | 'review'
  | 'pending'
  | 'failed'
  | 'duplicate'
  | 'ignored';

export type Direction = 'in' | 'out';

export interface Operation {
  id: string;
  date: string; // ISO
  customer: string;
  note: string;
  type: string;
  method: string;
  dir: Direction;
  status: OperationStatus;
  amount: number;
  currency: string;
  ref: string;
  account: string;
  user: string;
  /** مصدر الحركة: واتساب (رسالة واردة) أو إدخال يدوي/النظام */
  source?: 'whatsapp' | 'manual';
  /** نص رسالة واتساب الأصلية (للتتبّع) */
  waText?: string;
  waFrom?: string;
  waMessageId?: string;
  waSenderPhone?: string;
  fx?: { rate: number; usd: number; at: string; messageId: string };
  /** محادثة/مجموعة واتساب التي جاءت منها الحركة */
  chatJid?: string;
  chatName?: string;
}

export interface Kpis {
  sumIn: number;
  sumOut: number;
  net: number;
  needsAction: number;
  pending: number;
  postedCount: number;
  postRate: number;
  total: number;
}

export interface OperationsResponse {
  rows: Operation[];
  /** عدد الصفوف بعد الفلاتر */
  total: number;
  /** عدد كل العمليات في النظام */
  allTotal: number;
  page: number;
  perPage: number;
  pages: number;
  statusCounts: Record<string, number>;
  kpis: Kpis;
}

export interface SummaryResponse {
  kpis: Kpis;
  statusCounts: Record<string, number>;
  series: { labels: string[]; in: number[]; out: number[] };
  recent: Operation[];
}

export type SortKey = 'id' | 'date' | 'amount';
export type SortDir = 'asc' | 'desc';

export interface OperationsQuery {
  q?: string;
  status?: string[]; // مفصولة بفاصلة في الرابط
  type?: string;
  method?: string;
  dir?: string;
  from?: string;
  to?: string;
  sort?: SortKey;
  order?: SortDir;
  page?: number;
  perPage?: number;
}

export const STATUS_META: Record<
  OperationStatus,
  { label: string; cls: OperationStatus }
> = {
  posted: { label: 'مرحّلة', cls: 'posted' },
  review: { label: 'قيد المراجعة', cls: 'review' },
  pending: { label: 'معلّقة', cls: 'pending' },
  failed: { label: 'فاشلة', cls: 'failed' },
  duplicate: { label: 'مكررة', cls: 'duplicate' },
  ignored: { label: 'متجاهلة', cls: 'ignored' },
};

export const STATUS_KEYS = Object.keys(STATUS_META) as OperationStatus[];

export const TONE: Record<string, string> = {
  posted: 'var(--in)',
  review: 'var(--rev)',
  pending: 'var(--wait)',
  failed: 'var(--out)',
  duplicate: 'var(--dup)',
  ignored: 'var(--ign)',
};

export const TYPES = [
  'تحويل',
  'إيداع',
  'سحب',
  'دفع فاتورة',
  'شحن رصيد',
  'استرداد',
  'تسوية',
];

export const METHODS = ['بنك', 'كاش', 'محفظة', 'بطاقة', 'شيك'];
