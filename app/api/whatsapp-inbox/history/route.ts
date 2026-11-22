import { NextResponse } from 'next/server';
import { ensureBoot } from '@/lib/boot';
import { requestOlderHistory } from '@/lib/integrations/wa-web';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  ensureBoot();
  const data = await req.json().catch(() => ({}));
  if (typeof data.chat !== 'string' || data.chat.length > 120) return NextResponse.json({error:'المحادثة غير صالحة'}, {status:400});
  const result = await requestOlderHistory(data.chat);
  return NextResponse.json(result,{status:result.status,headers:{'Cache-Control':'no-store'}});
}
