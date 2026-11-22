import { NextResponse } from 'next/server';
import { countsBySheet, listLines, pendingForSheet, sheetTotals, totalsOf } from '@/lib/sheet';
import { listDays, listSheets } from '@/lib/sheets';
import { todayInTz, shiftDate } from '@/lib/dates';
import { dayReport, dailyReportState } from '@/lib/daily';
import { autoPostState } from '@/lib/auto-post';
import { ensureBoot } from '@/lib/boot';
import { withGroupAccount } from '@/lib/integrations/sheet-group-account';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sheet?sheet=<id|all>
 * يعيد سطور الشيت المطلوب + مجاميعه + الحركات المعلّقة + قائمة الشيتات.
 * `sheet` غير معطى = كل السطور مجتمعة.
 */
export async function GET(req: Request) {
  ensureBoot();
  const url = new URL(req.url);
  const sheet = url.searchParams.get('sheet') ?? 'all';
  const dayParam = url.searchParams.get('day') || 'today';
  const day =
    dayParam === 'today'
      ? todayInTz()
      : dayParam === 'yesterday'
      ? shiftDate(todayInTz(), -1)
      : dayParam; // تاريخ محدد أو 'all'

  // سطور اليوم المطلوب فقط (كل الأيام عند day=all)
  const dayLines = day === 'all' ? undefined : day;
  const pending = pendingForSheet(sheet === 'all' ? undefined : sheet);
  const auto = autoPostState();
  const counts = countsBySheet();
  const allLines = listLines(sheet === 'all' ? undefined : sheet);
  const lines = dayLines ? allLines.filter((l) => l.date === dayLines) : allLines;

  return NextResponse.json(
    {
      sheet,
      day,
      dayParam,
      days: listDays(),
      today: todayInTz(),
      yesterday: shiftDate(todayInTz(), -1),
      sheets: listSheets(day === 'all' ? undefined : day).map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        jid: s.jid,
        date: s.date,
        count: counts[s.id] ?? 0,
      })),
      daySummary: dayReport(day === 'all' ? todayInTz() : day),
      daily: dailyReportState(),
      lines: lines.map(withGroupAccount),
      totals: totalsOf(lines),
      pending: pending.map((o) => ({
        id: o.id,
        customer: o.customer,
        amount: o.amount,
        currency: o.currency,
        dir: o.dir,
        chatName: o.chatName ?? null,
      })),
      autoPost: {
        enabled: auto.enabled,
        intervalMin: auto.intervalMin,
        lastRun: auto.lastRuns[0]?.at ?? null,
        lastAdded: auto.lastRuns[0]?.added ?? null,
        totalRuns: auto.totalRuns,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** DELETE /api/sheet?sheet=<id|all> — حذف سطور الشيت (أو كل الحركات) */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const sheet = url.searchParams.get('sheet') ?? 'all';
  const { clearLines } = await import('@/lib/sheet');
  const removed = clearLines(sheet === 'all' ? undefined : sheet);
  return NextResponse.json({ ok: true, removed });
}
