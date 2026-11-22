import { NextResponse } from 'next/server';
import { hasStoredSession, startWaWeb, waWebState } from '@/lib/integrations/wa-web';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — حالة ربط الجهاز + رمز QR (إن وُجد) */
export async function GET() {
  const state = waWebState();

  // استئناف تلقائي: إن وُجدت جلسة محفوظة والخادم أُعيد تشغيله
  if (state.status === 'idle' && hasStoredSession()) {
    void startWaWeb();
    return NextResponse.json({ ...state, status: 'starting' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
