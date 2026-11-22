import { NextResponse } from 'next/server';
import { groupRules, setGroupMode, groupCurrencyRules, setGroupCurrencyMode, type GroupMode, type GroupCurrencyMode } from '@/lib/integrations/group-rules';
import { listWaGroups, waWebConnected } from '@/lib/integrations/wa-web';
import { ocrResults, ocrStatus } from '@/lib/integrations/image-ocr';
import { currentGroupRates } from '@/lib/integrations/group-fx';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const connected = waWebConnected();
  const groups = connected ? await listWaGroups() : [];
  return NextResponse.json({ connected, groups, rules: groupRules(), currencyRules: groupCurrencyRules(), rates: currentGroupRates(), ocr: await ocrStatus(), results: ocrResults() }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const isCurrency = body.currencyMode !== undefined;
  if (isCurrency ? !['original', 'usd'].includes(body.currencyMode) : !['text', 'images', 'off'].includes(body.mode)) return NextResponse.json({ error: 'خيار غير صالح' }, { status: 400 });
  if (!waWebConnected()) return NextResponse.json({ error: 'اربط واتساب أولاً' }, { status: 409 });
  const groups = await listWaGroups();
  if (!groups.some(g => g.jid === body.jid)) return NextResponse.json({ error: 'المجموعة غير موجودة في حساب واتساب المتصل' }, { status: 400 });
  try { if (isCurrency) setGroupCurrencyMode(body.jid, body.currencyMode as GroupCurrencyMode); else setGroupMode(body.jid, body.mode as GroupMode); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: 'تعذّر حفظ الإعداد' }, { status: 500 }); }
}
