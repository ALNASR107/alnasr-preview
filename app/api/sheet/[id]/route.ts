import { NextRequest, NextResponse } from 'next/server';
import { updateLine } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

/** PATCH /api/sheet/:id — تعديل مركز التكلفة / الحساب المقابل / المكافآت */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const allowed = ['costCenter', 'counterAccount', 'reward', 'debit', 'credit', 'statement'] as const;
  const clean: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in patch) clean[k] = (patch as Record<string, unknown>)[k];
  }
  if (typeof clean.reward === 'string') clean.reward = Number(clean.reward) || 0;

  const line = updateLine(id, clean as never);
  if (!line) return NextResponse.json({ error: 'السطر غير موجود' }, { status: 404 });
  return NextResponse.json({ line });
}

/** DELETE /api/sheet/:id — إزالة سطر من الشيت */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { const { removeLineAndSuppress } = await import('@/lib/sheet'); const removed = removeLineAndSuppress(id); return NextResponse.json({ removed }); }
  catch { return NextResponse.json({error:'تعذّر حفظ الحذف'}, {status:500}); }
}
