/**
 * أنواع وثوابت شيت الترحيل — آمنة للاستيراد في المتصفح (بدون أي وصول للقرص).
 * الجزء الذي يقرأ/يكتب الملفات موجود في `lib/sheet.ts` (سيرفر فقط).
 */
export type SheetLine = {
  id: string;
  opId: string;
  account: string;
  statement: string;
  debit: number; // مدين
  credit: number; // دائن
  currency: string;
  balance: number; // التعادل = المبلغ − (مدين + دائن)
  reward: number; // المكافآت
  costCenter: string; // مركز التكلفة
  date: string; // YYYY-MM-DD
  amount: number; // المبلغ
  counterAccount: string; // الحساب المقابل
  createdAt: string;
  /** مصدر الحركة (واتساب/يدوي) — لا يظهر كعمود في Excel */
  source?: 'whatsapp' | 'manual';
  fx?: { rate: number; usd: number; at: string; messageId: string };
  /** الشيت الذي ينتمي إليه السطر (محادثة/مجموعة/رئيسي) */
  sheetId?: string;
  /** سطر المجموعة الثانية المرتبط بنفس الحركة؛ لا يُحسب مرتين مع الأصل. */
  linkMirror?: boolean;
  linkedMessageId?: string;
};

export const COST_CENTERS = ['الإدارة العامة', 'الفرع الرئيسي', 'المبيعات', 'المشتريات', 'العمليات', 'المخازن'];
