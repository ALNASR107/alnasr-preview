import { NextResponse } from 'next/server';
import { startWaWeb } from '@/lib/integrations/wa-web';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/integrations/whatsapp/web/connect
 *   {}                      → يبدأ جلسة QR (امسح الرمز من الهاتف)
 *   { "phone": "9639…" }    → ربط برمز اقتران: يعيد رمزًا من 8 خانات يُدخل في واتساب
 *
 * خطوات الربط برمز: واتساب ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز
 *                   ← «الربط برقم الهاتف بدلًا من ذلك» ← أدخل الرمز.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const phone = String(body?.phone ?? '').replace(/\D/g, '');

  const state = await startWaWeb(phone.length >= 8 ? { phone } : undefined);
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
