import { NextRequest, NextResponse } from 'next/server';
import { allOperations, computeKpis, dailySeries, sortOperations, statusCounts } from '@/lib/mock';

export const dynamic = 'force-dynamic';

/** GET /api/summary?days=14 — مؤشرات لوحة المتابعة */
export async function GET(req: NextRequest) {
  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days') ?? 14)));
  const ops = allOperations();

  return NextResponse.json({
    kpis: computeKpis(ops),
    statusCounts: statusCounts(ops),
    series: dailySeries(ops, days),
    recent: sortOperations(ops, 'date', 'desc').slice(0, 7),
  });
}
