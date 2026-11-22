import { NextResponse } from 'next/server';
import { historyStatus, postYesterday } from '@/lib/integrations/wa-history';
import { waWebState } from '@/lib/integrations/wa-web';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const wa = waWebState();
  return NextResponse.json({ connected: wa.status === 'connected', ...historyStatus(wa.me) }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST() {
  const wa = waWebState();
  if (wa.status !== 'connected' || !wa.me) return NextResponse.json({ error: 'اربط واتساب أولاً' }, { status: 409 });
  return NextResponse.json({ ok: true, ...postYesterday(wa.me) });
}
