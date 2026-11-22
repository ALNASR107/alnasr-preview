import { NextRequest, NextResponse } from 'next/server';
import { getOperation, updateStatus } from '@/lib/mock';
import { onOperationPosted } from '@/lib/integrations/notify';
import { STATUS_KEYS, type OperationStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/operations/:id */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const op = getOperation(id);
  if (!op) return NextResponse.json({ error: 'العملية غير موجودة' }, { status: 404 });
  return NextResponse.json({ operation: op });
}

/**
 * PATCH /api/operations/:id  { status: 'posted' }
 * هنا مكان كتابة منطق الترحيل الحقيقي (قيد محاسبي، تحقق من الصلاحيات، سجل تتبّع…)
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };

  if (!body.status || !STATUS_KEYS.includes(body.status as OperationStatus)) {
    return NextResponse.json({ error: 'حالة غير صالحة' }, { status: 400 });
  }

  const op = updateStatus(id, body.status as OperationStatus);
  if (!op) return NextResponse.json({ error: 'العملية غير موجودة' }, { status: 404 });

  // بعد الترحيل: إشعار واتساب + دفع الفاتورة إلى وكيد.
  // في الإنتاج: ضعها في طابور (queue) بدل انتظار الطلب.
  let integrations: Awaited<ReturnType<typeof onOperationPosted>> | undefined;
  if (op.status === 'posted') {
    integrations = await onOperationPosted(op).catch(() => undefined);
  }

  return NextResponse.json({ operation: op, integrations });
}
