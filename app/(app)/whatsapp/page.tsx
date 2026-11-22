import type { Metadata } from 'next';
import WhatsAppView from '@/components/WhatsAppView';
export const metadata: Metadata = { title: 'محادثات واتساب' };
export const dynamic = 'force-dynamic';
export default function WhatsAppPage() { return <WhatsAppView />; }
