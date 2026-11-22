/**
 * بناء رسالة واتساب تحتوي الشيت (كل الحركات المجمّعة) لترسلها إلى رقم أو مجموعة.
 */
import { expandDouble, listLines, sheetTotals } from '@/lib/sheet';
import { CURRENCY } from '@/lib/format';

const n = (v: number) => v.toLocaleString('en-US');

export function buildSheetMessage(opts?: { limit?: number; mode?: 'single' | 'double'; title?: string; sheetId?: string }) {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 200);
  const mode = opts?.mode ?? 'single';
  const all = listLines(opts?.sheetId);
  const lines = (mode === 'double' ? expandDouble(all) : all).slice(0, limit);
  const t = sheetTotals(opts?.sheetId);

  const head =
    `📊 *${opts?.title ?? 'شيت الترحيل — شركة النصر'}*\n` +
    `📅 ${new Date().toLocaleString('ar-EG')}\n` +
    `• السطور: ${n(t.count)} · مدين: ${n(t.debit)} ${CURRENCY} · دائن: ${n(t.credit)} ${CURRENCY}\n` +
    `• ${t.rowsValid ? 'كل سطر بطرف واحد مع حساب مقابل ✔' : 'سطور تحتاج مراجعة ✖'}\n` +
    (mode === 'double' ? `• الوضع: قيد مزدوج (${n((t.debit + t.credit) / 2)} متوازن)\n` : '') +
    `\n`;

  const rows = lines
    .map((l, i) => {
      const side = l.debit > 0 ? `مدين ${n(l.debit)}` : `دائن ${n(l.credit)}`;
      return `${i + 1}. ${l.date} | ${l.account} | ${side} | ${l.counterAccount} | ${l.costCenter}`;
    })
    .join('\n');

  const tail =
    all.length > lines.length
      ? `\n\n… و${n(all.length - lines.length)} سطرًا آخر. الملف الكامل (Excel) من صفحة الشيت في الموقع.`
      : '';

  return `${head}\`\`\`\n${rows}\n\`\`\`${tail}`;
}
