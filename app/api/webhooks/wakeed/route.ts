import { NextRequest, NextResponse } from 'next/server';
import { verifyWakeedSignature } from '@/lib/integrations/wakeed';
import { logEvent } from '@/lib/integrations/log';
import { getOperation, updateStatus } from '@/lib/mock';

export const dynamic = 'force-dynamic';

/**
 * POST — Webhook من وكيد (تحديث حالة فاتورة/اعتماد قيد).
 * الصيغة النهائية تُؤخذ من توثيق وكيد عند التفعيل؛ هنا نتعامل مع الحقول الشائعة:
 *   { event: 'invoice.paid', external_id: 'OP-24599', status: 'paid' }
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-wakeed-signature') ?? req.headers.get('x-signature');

  if (!(await verifyWakeedSignature(raw, sig))) {
    return new NextResponse('invalid signature', { status: 401 });
  }

  let body: any = {};
  try {
    body = JSON.parse(raw);
  } catch {
    /* تجاهل */
  }

  const externalId: string | undefined = body.external_id ?? body.reference ?? body.invoice?.external_id;
  const status: string | undefined = body.status ?? body.event;

  if (externalId) {
    const op = getOperation(externalId);
    if (op) {
      if (['paid', 'posted', 'approved', 'invoice.paid'].includes(String(status))) {
        updateStatus(op.id, 'posted');
      }
      logEvent({ ch: 'wakeed', ok: true, msg: `Webhook ${externalId}: ${status}` });
    } else {
      logEvent({ ch: 'wakeed', ok: false, msg: `عملية غير معروفة: ${externalId}` });
    }
  } else {
    logEvent({ ch: 'wakeed', ok: true, msg: `Webhook عام: ${String(status)}` });
  }

  return NextResponse.json({ received: true });
}
