import { NextResponse } from 'next/server';
import { ensureBoot } from '@/lib/boot';
import { waWebState } from '@/lib/integrations/wa-web';
import { scheduleHistory, history48Status } from '@/lib/integrations/wa-history';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST() { ensureBoot(); const wa=waWebState(); if (wa.status === 'connected' && wa.me) scheduleHistory(wa.me, 30000); return NextResponse.json({ ok:true, connected:wa.status==='connected', note:'يُعالج المتاح فقط؛ مزامنة واتساب قد تكون غير مكتملة.' }); }
export async function GET() { ensureBoot(); const wa=waWebState(); return NextResponse.json({ connected:wa.status === 'connected', ...history48Status(wa.me) },{headers:{'Cache-Control':'no-store'}}); }
