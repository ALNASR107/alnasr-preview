import { NextResponse } from 'next/server';
import { buildDailyMessage, sendDailyReport } from '@/lib/daily';
import { todayInTz } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/summary/daily/send { date?, to? } — إرسال ملخّص اليوم إلى واتساب */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { date?: string; to?: string; preview?: boolean };
  const date = body.date || todayInTz();

  if (body.preview) {
    return NextResponse.json({ ok: true, date, text: buildDailyMessage(date) });
  }

  const res = await sendDailyReport({ date, to: body.to });
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
