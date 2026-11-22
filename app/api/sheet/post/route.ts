import { NextRequest, NextResponse } from 'next/server';
import { postAllPending, postToSheet, pendingForSheet, sheetTotals, listLines } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sheet/post — ترحيل الحركات إلى الشيت
 * body: { ids?: string[], all?: boolean, costCenter?: string, sheet?: string }
 * بلا `sheet`: كل حركة تذهب إلى شيت محادثتها/مجموعتها تلقائيًا.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    all?: boolean;
    costCenter?: string;
    sheet?: string;
  };

  const opts = { costCenter: body.costCenter, sheetId: body.sheet };

  const result = body.all ? postAllPending(opts) : postToSheet(body.ids ?? [], opts);

  return NextResponse.json({
    ...result,
    totals: sheetTotals(body.sheet === 'all' ? undefined : body.sheet),
    lines: listLines(body.sheet === 'all' ? undefined : body.sheet),
    pendingCount: pendingForSheet(body.sheet === 'all' ? undefined : body.sheet).length,
  });
}
