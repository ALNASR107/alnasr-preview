import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { displayImage } from '@/lib/integrations/wa-display';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params; const found = displayImage(id);
  if (!found) return new NextResponse('الصورة غير متاحة', { status: 404 });
  try { return new NextResponse(await readFile(found.file), { headers: { 'Content-Type': found.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': found.mime.startsWith('image/') || found.mime.startsWith('audio/') || found.mime.startsWith('video/') ? 'inline' : 'attachment' } }); }
  catch { return new NextResponse('الصورة غير متاحة', { status: 404 }); }
}
