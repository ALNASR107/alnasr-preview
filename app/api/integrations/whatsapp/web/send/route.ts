import { NextRequest, NextResponse } from 'next/server';
import { sendWaWebText, waWebConnected } from '@/lib/integrations/wa-web';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST { to, text } — إرسال رسالة من رقمك المرتبط */
export async function POST(req: NextRequest) {
  const { to, text } = (await req.json().catch(() => ({}))) as { to?: string; text?: string };
  if (!to) return NextResponse.json({ error: 'رقم المستلم مطلوب' }, { status: 400 });
  if (!text?.trim()) return NextResponse.json({ error: 'نص الرسالة مطلوب' }, { status: 400 });
  if (!waWebConnected()) {
    return NextResponse.json({ error: 'اربط الجهاز أولًا من صفحة الإعدادات' }, { status: 409 });
  }

  const r = await sendWaWebText(to, text.trim());
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
