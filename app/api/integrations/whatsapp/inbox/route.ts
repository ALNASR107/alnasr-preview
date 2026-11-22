import { NextResponse } from 'next/server';
import { inboxStats, listInbox } from '@/lib/integrations/wa-inbox';
import { ensureBoot } from '@/lib/boot';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — سجل رسائل واتساب الواردة التي صارت حركات (+ الإحصاء) */
export async function GET() {
  ensureBoot();
  return NextResponse.json(
    { items: listInbox().slice(0, 50), stats: inboxStats() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
