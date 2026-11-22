/**
 * إشعارات جاهزة للاستخدام بعد ترحيل/تحديث أي عملية.
 * تُستدعى من مسار PATCH — ولا تُعطّل الاستجابة إن فشل الإرسال.
 */
import type { Operation } from '@/lib/types';
import { money } from '@/lib/format';
import { sendWhatsAppTemplate, sendWhatsAppText, whatsappConfigured } from './whatsapp';
import { pushOperationToWakeed, wakeedConfigured } from './wakeed';
import { logEvent } from './log';

const TEMPLATE = process.env.WHATSAPP_OP_TEMPLATE ?? 'amanah_operation_posted';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG ?? 'ar';

/** عند اعتماد وترحيل عملية: إشعار واتساب + دفع الفاتورة إلى وكيد */
export async function onOperationPosted(op: Operation, customerPhone?: string) {
  const results: { whatsapp?: string; wakeed?: string } = {};

  // 1) واتساب — إن كان الرقم متاحًا
  const to = customerPhone ?? process.env.WHATSAPP_NOTIFY_TO;
  if (to && whatsappConfigured()) {
    const message = `تم ترحيل عمليتك ${op.id} بمبلغ ${money(op.amount)} ${op.currency}. شكرًا لثقتك بشركة النصر.`;
    const r = await sendWhatsAppTemplate(to, TEMPLATE, TEMPLATE_LANG, [
      op.customer,
      op.id,
      `${money(op.amount)} ${op.currency}`,
    ]);
    if (!r.ok) {
      // قد يكون القالب غير مُعتمد بعد → نحاول نصًا حرًا كخطة بديلة
      const fallback = await sendWhatsAppText(to, message);
      results.whatsapp = fallback.ok ? 'text' : fallback.error;
      logEvent({ ch: 'whatsapp', ok: fallback.ok, msg: fallback.ok ? `إشعار نصي ${op.id}` : `فشل: ${fallback.error}` });
    } else {
      results.whatsapp = 'template';
      logEvent({ ch: 'whatsapp', ok: true, msg: `قالب ${TEMPLATE} → ${op.id}` });
    }
  }

  // 2) وكيد — فاتورة/قيد محاسبي
  if (wakeedConfigured()) {
    const r = await pushOperationToWakeed(op);
    results.wakeed = r.skipped ? 'skipped' : r.ok ? 'pushed' : r.error;
    logEvent({
      ch: 'wakeed',
      ok: r.ok,
      msg: r.ok ? `تم دفع الفاتورة ${op.id}` : `فشل الدفع ${op.id}: ${r.error}`,
    });
  }

  return results;
}
