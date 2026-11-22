import type { Metadata } from 'next';
import SheetView from '@/components/SheetView';

export const metadata: Metadata = { title: 'شيت الترحيل' };
export const dynamic = 'force-dynamic';

export default function SheetPage() {
  return <SheetView />;
}
