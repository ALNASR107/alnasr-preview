import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/session — هل الجلسة قابلة للاستخدام في هذا المتصفح؟
 * بعض البيئات (iframe معزول أو حظر كوكيز) ترفض حفظ الكوكي، فنكتشف ذلك
 * بدل أن يبقى زر الدخول في حالة تحميل إلى ما لا نهاية.
 */
export async function GET() {
  const store = await cookies();
  return NextResponse.json({
    authenticated: Boolean(store.get('amanah_session')),
    user: store.get('amanah_user')?.value ?? null,
    demo: process.env.DEMO_MODE === '1',
  });
}
