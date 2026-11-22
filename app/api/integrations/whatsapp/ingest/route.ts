import { NextResponse } from 'next/server';
import { ingestMessage, parseOperationText } from '@/lib/integrations/wa-inbox';
import { ensureBoot } from '@/lib/boot';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/integrations/whatsapp/ingest
 *   { text: "تحويل 500000 من شركة النور بنك", chat?, fromName?, dryRun? }
 * نفس المسار الذي تستخدمه رسائل واتساب الواردة — مفيد للتجربة أو لإدخال حركة من واجهة الموقع.
 */
export async function POST(req: Request) {
  ensureBoot();
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    chat?: string;
    fromName?: string;
    chatName?: string;
    dryRun?: boolean;
  };
  const text = String(body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'النص مطلوب' }, { status: 400 });

  if (body.dryRun) {
    const parsed = parseOperationText(text);
    return NextResponse.json({ parsed: parsed ?? null, ok: Boolean(parsed) });
  }

  const res = ingestMessage({
    text,
    chat: body.chat ?? 'web@local',
    fromName: body.fromName ?? 'إدخال من الموقع',
    chatName: body.chatName,
  });
  if (!res.ok) return NextResponse.json({ error: res.reason ?? 'لم أفهم المبلغ' }, { status: 422 });

  return NextResponse.json({ ok: true, operation: res.op, line: res.line }, { status: 201 });
}
