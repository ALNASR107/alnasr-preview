import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

/**
 * POST /api/auth/login { email, password }
 * - إذا ضُبط ADMIN_EMAIL + ADMIN_PASSWORD في البيئة: تُقبل هذه البيانات فقط (وضع الإنتاج).
 * - وإلا (تجريبي): أي بريد صحيح + كلمة مرور 4 أحرف تكفي، وكلمة 0000 تُظهر حالة الخطأ.
 * الجلسة كوكي موقّع بـ HMAC (lib/session.ts) فلا يمكن تزويرها.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? '').trim();
  const password = body.password ?? '';

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const enforced = Boolean(adminEmail && adminPassword);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || /^[a-zA-Z0-9._-]{3,}$/.test(email);
  if (!emailOk) return NextResponse.json({ error: 'أدخل بريدًا إلكترونيًا صحيحًا' }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ error: 'كلمة المرور مطلوبة — 4 أحرف على الأقل' }, { status: 400 });

  if (enforced) {
    // مقارنة بزمن ثابت لتقليل أثر تحليل التوقيت
    const a = Buffer.from(email.toLowerCase() + ':' + password);
    const b = Buffer.from(String(adminEmail).toLowerCase() + ':' + String(adminPassword));
    const same = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!same) return NextResponse.json({ error: 'بيانات الدخول غير صحيحة، تحقّق من البريد وكلمة المرور' }, { status: 401 });
  } else if (password === '0000') {
    return NextResponse.json({ error: 'بيانات الدخول غير صحيحة، تحقّق من البريد وكلمة المرور' }, { status: 401 });
  }

  const user = { name: process.env.ADMIN_NAME || 'محمد الأحمد', role: process.env.ADMIN_ROLE || 'مدير العمليات', email };
  const res = NextResponse.json({ ok: true, user });

  // على https: SameSite=None; Secure ليعمل أيضًا داخل الإطارات المضمّنة (iframe)
  const secure = new URL(req.url).protocol === 'https:';
  const base = {
    path: '/',
    maxAge: SESSION_MAX_AGE,
    ...(secure ? { sameSite: 'none' as const, secure: true } : { sameSite: 'lax' as const }),
  };

  res.cookies.set(SESSION_COOKIE, createSessionToken(), { ...base, httpOnly: true });
  res.cookies.set('amanah_user', user.name, base);

  return res;
}
