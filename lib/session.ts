/**
 * جلسة موقّعة بـ HMAC-SHA256 (بدون مكتبات خارجية).
 * - التوقيع في مسارات الـ API يتم عبر `node:crypto` (هذا الملف).
 * - التحقق في `middleware.ts` يتم عبر Web Crypto (يعمل على حافّة الشبكة).
 * هذا يمنع أي شخص من تزوير كوكي `amanah_session` بمجرّد تخمين قيمتها.
 */
import crypto from 'node:crypto';

export const SESSION_COOKIE = 'amanah_session';
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 ساعات

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) console.warn('[session] SESSION_SECRET غير مضبوط — استخدم قيمة قوية في الإنتاج');
  return s || 'amanah-dev-secret-change-me';
}

function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

/** ينشئ قيمة الكوكي: v1.<exp>.<hmac> */
export function createSessionToken(ttlSec = SESSION_MAX_AGE) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `v1.${exp}`;
  return `${payload}.${sign(payload)}`;
}
