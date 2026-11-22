import { NextResponse } from 'next/server';
import { sendWaWebText, waWebConnected } from '@/lib/integrations/wa-web';
import { buildSheetMessage } from '@/lib/sheet-report';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/integrations/whatsapp/web/send-sheet
 *   { to?: "9639…" | "1203630…@g.us", limit?, mode?, title?, sheet? }
 * يرسل الشيت كرسالة واتساب إلى رقم أو مجموعة. `sheet` = شيت محدّد، وإلا كل السطور.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    limit?: number;
    mode?: 'single' | 'double';
    title?: string;
    sheet?: string;
  };
  const to = body.to?.trim() || process.env.WA_AUTO_SUMMARY_TO || '';
  if (!to) return NextResponse.json({ error: 'حدّد رقمًا أو مجموعة (to)' }, { status: 400 });
  if (!waWebConnected()) return NextResponse.json({ error: 'واتساب غير مرتبط' }, { status: 409 });

  const text = buildSheetMessage({ limit: body.limit, mode: body.mode, title: body.title, sheetId: body.sheet });
  const res = await sendWaWebText(to, text);
  return NextResponse.json({ ...res, to, chars: text.length }, { status: res.ok ? 200 : 502 });
}
