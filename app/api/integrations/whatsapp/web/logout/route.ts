import { NextResponse } from 'next/server';
import { logoutWaWeb } from '@/lib/integrations/wa-web';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST — إنهاء الربط وحذف الجلسة من الذاكرة */
export async function POST() {
  const state = await logoutWaWeb();
  return NextResponse.json(state);
}
