import { NextResponse } from 'next/server';
import { createSheet, listSheets } from '@/lib/sheets';
import { totalsBySheet } from '@/lib/sheet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/sheets — كل الشيتات مع عدد السطور ومجاميعها */
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date') ?? undefined;
  const totals = totalsBySheet();
  const sheets = listSheets(date).map((s) => ({
    ...s,
    count: totals[s.id]?.count ?? 0,
    debit: totals[s.id]?.debit ?? 0,
    credit: totals[s.id]?.credit ?? 0,
  }));
  return NextResponse.json({ sheets }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST /api/sheets { name } — إنشاء شيت يدوي */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; date?: string };
  const sheet = createSheet(String(body.name ?? ''), body.date);
  return NextResponse.json({ sheet }, { status: 201 });
}
