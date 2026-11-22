import { NextRequest, NextResponse } from 'next/server';
import { verifyWhatsAppSignature, sendWhatsAppText } from '@/lib/integrations/whatsapp';
import { logEvent } from '@/lib/integrations/log';
import { getOperation, updateStatus } from '@/lib/mock';

export const dynamic = 'force-dynamic';

/** GET — تحقّق ميتا من الويبهوك (يُطلب مرة واحدة عند الإعداد) */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logEvent({ ch: 'whatsapp', ok: true, msg: 'تم التحقق من الويبهوك' });
    return new NextResponse(challenge ?? 'ok', { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

/**
 * POST — استقبال الرسائل الواردة.
 * أوامر مدعومة (مثال): «قبول OP-24599» أو «رفض OP-24599»
 * أي رسالة أخرى تُسجَّل فقط. اربطها لاحقًا بردّ آلي أو تذكرة دعم.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifyWhatsAppSignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('invalid signature', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // نتجاهل ما ليس JSON
  }

  const messages: any[] =
    payload?.entry?.flatMap((e: any) => e?.changes?.flatMap((c: any) => c?.value?.messages ?? []) ?? []) ?? [];

  for (const m of messages) {
    const from = m?.from as string | undefined;
    const text = (m?.text?.body ?? '').trim();
    if (!from) continue;

    const match = text.match(/(قبول|رفض|اعتماد)\s*(OP-\d+)/i);
    if (match && match[2]) {
      const id = match[2].toUpperCase();
      const op = getOperation(id);
      if (!op) {
        await sendWhatsAppText(from, `لم أجد العملية ${id}. تأكّد من الرقم وحاول مجددًا.`);
        continue;
      }
      const approve = match[1] !== 'رفض';
      updateStatus(id, approve ? 'posted' : 'review');
      await sendWhatsAppText(
        from,
        approve ? `تم اعتماد وترحيل ${id} ✅` : `تم إرجاع ${id} إلى المراجعة.`,
      );
      logEvent({ ch: 'whatsapp', ok: true, msg: `أمر من ${from}: ${text}` });
    } else {
      await sendWhatsAppText(from, 'أرسل: «اعتماد OP-24599» لترحيل العملية، أو «رفض OP-24599».');
      logEvent({ ch: 'whatsapp', ok: true, msg: `رسالة من ${from}: ${text || '[وسائط]'}` });
    }
  }

  return NextResponse.json({ ok: true });
}
