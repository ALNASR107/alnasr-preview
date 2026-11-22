import { NextResponse } from 'next/server';
import { whatsappConfigured } from '@/lib/integrations/whatsapp';
import { wakeedConfigured } from '@/lib/integrations/wakeed';
import { recentEvents } from '@/lib/integrations/log';

export const dynamic = 'force-dynamic';

/** GET /api/integrations/status — حالة التكاملات + آخر الأحداث */
export async function GET() {
  return NextResponse.json({
    whatsapp: {
      configured: whatsappConfigured(),
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? '••••' + process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4) : null,
      notifyTo: process.env.WHATSAPP_NOTIFY_TO ?? null,
    },
    wakeed: {
      configured: wakeedConfigured(),
      baseUrl: process.env.WAKEED_BASE_URL ?? null,
    },
    events: recentEvents(10),
  });
}
