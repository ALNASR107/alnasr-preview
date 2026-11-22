import type { Metadata } from 'next';
import IntegrationsSettings, { type IntegrationsStatus } from '@/components/IntegrationsSettings';
import { whatsappConfigured } from '@/lib/integrations/whatsapp';
import { wakeedConfigured } from '@/lib/integrations/wakeed';
import { recentEvents } from '@/lib/integrations/log';

export const metadata: Metadata = { title: 'الإعدادات والتكاملات' };
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const initial: IntegrationsStatus = {
    whatsapp: {
      configured: whatsappConfigured(),
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
        ? '••••' + process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4)
        : null,
      notifyTo: process.env.WHATSAPP_NOTIFY_TO ?? null,
    },
    wakeed: {
      configured: wakeedConfigured(),
      baseUrl: process.env.WAKEED_BASE_URL ?? null,
    },
    events: recentEvents(10),
  };

  return <IntegrationsSettings initial={initial} />;
}
