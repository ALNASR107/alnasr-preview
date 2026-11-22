/**
 * تكامل واتساب عبر WhatsApp Cloud API (ميتا) — رسمي ومستقر.
 *
 * المتغيّرات المطلوبة في .env.local:
 *   WHATSAPP_TOKEN=EAAG...                 // System User token دائم
 *   WHATSAPP_PHONE_NUMBER_ID=1234567890    // Phone number ID من لوحة ميتا
 *   WHATSAPP_VERIFY_TOKEN=amanah-verify    // أي نص تختاره أنت (للويبهوك)
 *   WHATSAPP_APP_SECRET=...                // للتحقق من توقيع الويبهوك
 *   WHATSAPP_NOTIFY_TO=9639xxxxxxxx        // اختياري: رقم لاستلام إشعارات العمليات
 *
 * بدون هذه المتغيّرات يعمل النظام في «وضع تجريبي»: يُسجَّل الإجراء ولا يُرسل شيء.
 */
import crypto from 'node:crypto';

const GRAPH = 'https://graph.facebook.com/v21.0';

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** توحيد الرقم إلى صيغة دولية بلا + أو أصفار بادئة */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return '963' + digits.slice(1); // عدّل رمز البلد الافتراضي حسب عملك
  return digits;
}

type SendResult = { ok: boolean; skipped?: boolean; id?: string; error?: string };

async function call(_payload: Record<string, unknown>): Promise<SendResult> {
  return { ok: false, error: 'إرسال الرسائل معطّل بطلب المستخدم' };
}

/** رسالة نصية حرة — تُقبل فقط داخل نافذة 24 ساعة من آخر رسالة للعميل */
export function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  return call({ to: normalizePhone(to), type: 'text', text: { preview_url: false, body } });
}

/**
 * رسالة قالب (Template) — هي الطريقة المعتمدة للإشعارات التي تُرسل دون أن يبدأ العميل المحادثة.
 * يجب إنشاء القالب واعتماده مسبقًا في WhatsApp Manager.
 */
export function sendWhatsAppTemplate(
  to: string,
  name: string,
  lang: string,
  params: string[],
): Promise<SendResult> {
  return call({
    to: normalizePhone(to),
    type: 'template',
    template: {
      name,
      language: { code: lang },
      components: params.length
        ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }]
        : [],
    },
  });
}

/** التحقق من توقيع ميتا: X-Hub-Signature-256 = sha256=HMAC(app_secret, rawBody) */
export function verifyWhatsAppSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // في التطوير فقط
  if (!signature?.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
