import { NextResponse } from 'next/server';
import { waWebState } from '@/lib/integrations/wa-web';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET — تشخيص الاستقبال: آخر الرسائل التي وصلت للخادم ونتيجة معالجتها
 * (مفيد لمعرفة إن كانت الرسائل تصل أصلًا، أو أن الاستقبال تجاهلها).
 */
export async function GET() {
  const st = waWebState();
  return NextResponse.json(
    {
      status: st.status,
      me: st.me,
      ingestEnabled: (process.env.WA_INGEST_ENABLED ?? '1') !== '0',
      groupsAllowed: (process.env.WA_INGEST_GROUPS ?? '1') !== '0',
      fromMeAllowed: (process.env.WA_INGEST_FROM_ME ?? '1') === '1',
      recent: st.recent ?? [],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
