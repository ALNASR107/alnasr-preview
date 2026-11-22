import { NextRequest, NextResponse } from 'next/server';
import { getSheet, removeSheet, renameSheet } from '@/lib/sheets';
import { clearLines } from '@/lib/sheet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** PATCH /api/sheets/:id { name } — إعادة تسمية الشيت */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const sheet = renameSheet(decodeURIComponent(id), String(body.name ?? ''));
  if (!sheet) return NextResponse.json({ error: 'الشيت غير موجود أو الاسم فارغ' }, { status: 400 });
  return NextResponse.json({ sheet });
}

/** DELETE /api/sheets/:id — حذف الشيت وكل سطوره */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sheetId = decodeURIComponent(id);
  if (!getSheet(sheetId)) return NextResponse.json({ error: 'الشيت غير موجود' }, { status: 404 });
  const removedLines = clearLines(sheetId);
  const ok = removeSheet(sheetId);
  if (!ok) return NextResponse.json({ error: 'لا يمكن حذف الشيت الرئيسي' }, { status: 400 });
  return NextResponse.json({ ok: true, removedLines });
}
