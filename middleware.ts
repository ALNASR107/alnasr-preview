import { NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/dashboard', '/operations', '/sheet', '/reports', '/clients', '/settings', '/whatsapp', '/api/whatsapp-inbox', '/api/whatsapp-group-rules', '/api/whatsapp-image', '/api/history-sync', '/api/operations', '/api/sheet'];

/**
 * تحقّق من توقيع كوكي الجلسة (HMAC-SHA256) باستخدام Web Crypto — يعمل على الحافة.
 * القيمة المتوقعة: v1.<exp>.<hex-hmac>
 */
async function validSession(token: string | undefined) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const [, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;

  const secret = process.env.SESSION_SECRET || 'amanah-dev-secret-change-me';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = new Uint8Array((sig.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
  try {
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`v1.${exp}`));
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if ((pathname.startsWith('/api/') && req.method !== 'GET') || pathname.startsWith('/api/integrations/') || pathname.startsWith('/api/whatsapp') || pathname.startsWith('/api/history-sync')) return new NextResponse('Preview: read only', {status: 403});

  // DEMO_MODE=1 يتيح التصفّح دون جلسة (للمعاينة داخل إطار مضمّن حيث تُحجب الكوكيز).
  // اتركه غير مفعّل في الإنتاج.
  const demo = process.env.DEMO_MODE === '1';

  const token = req.cookies.get('amanah_session')?.value;
  const authed = token ? await validSession(token) : false;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isProtected && !authed && !demo) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/operations' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (pathname === '/login' && authed && !demo) {
    const url = req.nextUrl.clone();
    url.pathname = '/operations';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/login', '/dashboard/:path*', '/operations/:path*', '/sheet/:path*', '/reports/:path*', '/clients/:path*', '/settings/:path*', '/whatsapp/:path*', '/api/whatsapp-inbox/:path*', '/api/whatsapp-group-rules/:path*', '/api/whatsapp-image/:path*', '/api/history-sync/:path*', '/api/operations/:path*', '/api/sheet/:path*'],
};
