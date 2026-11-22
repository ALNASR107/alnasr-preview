import { NextRequest, NextResponse } from 'next/server';
import { getOperation } from '@/lib/mock';
import { pushOperationToWakeed, wakeedConfigured } from '@/lib/integrations/wakeed';
import { logEvent } from '@/lib/integrations/log';

export const dynamic = 'force-dynamic';

/** POST /api/integrations/wakeed/sync { id } — دفع عملية محددة إلى وكيد */
export async function POST(req: NextRequest) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: 'معرّف العملية مطلوب' }, { status: 400 });

  const op = getOperation(id);
  if (!op) return NextResponse.json({ error: 'العملية غير موجودة' }, { status: 404 });

  if (!wakeedConfigured()) {
    logEvent({ ch: 'wakeed', ok: true, msg: `وضع تجريبي: تم تجهيز ${id} (بلا إرسال)` });
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: 'وكيد غير مهيّأ — تم تجهيز الفاتورة دون إرسال',
      invoice: op.id,
    });
  }

  const r = await pushOperationToWakeed(op);
  logEvent({ ch: 'wakeed', ok: r.ok, msg: r.ok ? `دُفعت ${id}` : `فشل ${id}: ${r.error}` });
  return NextResponse.json({ ok: r.ok, error: r.error, status: r.status }, { status: r.ok ? 200 : 502 });
}
