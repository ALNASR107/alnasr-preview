import { NextResponse } from 'next/server';
import { analyseAttachment } from '@/lib/integrations/attachment-analysis';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { return NextResponse.json(await analyseAttachment(id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { const msg = (e as Error).message || ''; return NextResponse.json({ error: /ENOENT/.test(msg) ? 'أداة القراءة المحلية غير مثبتة على هذا الجهاز' : msg }, { status: 422 }); }
}
