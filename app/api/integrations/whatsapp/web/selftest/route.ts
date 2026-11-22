import { NextResponse } from 'next/server';
import { selfTestIngest } from '@/lib/integrations/wa-web';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST — فحص شامل للاستقبال: يرسل حركة تجريبية إلى محادثة نفسك ويعيد ما جرى */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { amount?: number };
  const res = await selfTestIngest(Number(body.amount) > 0 ? Number(body.amount) : 1000);
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
