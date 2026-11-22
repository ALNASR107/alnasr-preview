import { NextResponse } from 'next/server';
import { dayReport, allReport, dailyReportState } from '@/lib/daily';
import { todayInTz, shiftDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/summary/daily?date=today|yesterday|YYYY-MM-DD|all
 * ملخّص يوم واحد: العدد + المجاميع لكل عملة + لكل شيت (محادثة/مجموعة).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get('date') || 'today').trim();
  const today = todayInTz();
  const date =
    raw === 'today' || raw === '' ? today
    : raw === 'yesterday' ? shiftDate(today, -1)
    : raw;
  const report = date === 'all' ? allReport() : dayReport(date);
  return NextResponse.json(
    { report, daily: dailyReportState() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
