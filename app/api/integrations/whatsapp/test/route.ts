import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppText, whatsappConfigured, normalizePhone } from '@/lib/integrations/whatsapp';
import { logEvent } from '@/lib/integrations/log';

export const dynamic = 'force-dynamic';

/** POST /api/integrations/whatsapp/test { to, text } — رسالة اختبار */
export async function POST(req: NextRequest) {
  const { to, text } = (await req.json().catch(() => ({}))) as { to?: string; text?: string };
  if (!to) return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });

  const body = text?.trim() || 'رسالة اختبار من شركة النصر ✅';
  const phone = normalizePhone(to);

  if (!whatsappConfigured()) {
    logEvent({ ch: 'whatsapp', ok: true, msg: `وضع تجريبي: رسالة إلى ${phone}` });
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: `وضع تجريبي — لم تُرسل رسالة فعلية إلى ${phone}`,
    });
  }

  const r = await sendWhatsAppText(phone, body);
  logEvent({ ch: 'whatsapp', ok: r.ok, msg: r.ok ? `اختبار إلى ${phone}` : `فشل: ${r.error}` });
  return NextResponse.json({ ok: r.ok, error: r.error, id: r.id }, { status: r.ok ? 200 : 502 });
}
