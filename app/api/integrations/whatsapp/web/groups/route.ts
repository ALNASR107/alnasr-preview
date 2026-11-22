import { NextResponse } from 'next/server';
import { listWaGroups, waWebConnected } from '@/lib/integrations/wa-web';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — مجموعات واتساب المتاحة على الجهاز المرتبط (لإرسال الشيت إليها) */
export async function GET() {
  if (!waWebConnected()) {
    return NextResponse.json({ groups: [], error: 'الجهاز غير مرتبط' }, { status: 200 });
  }
  const groups = await listWaGroups();
  return NextResponse.json({ groups }, { headers: { 'Cache-Control': 'no-store' } });
}
