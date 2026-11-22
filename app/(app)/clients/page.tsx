import type { Metadata } from 'next';
import SectionPlaceholder from '@/components/SectionPlaceholder';

export const metadata: Metadata = { title: 'العملاء' };

export default function Page() {
  return <SectionPlaceholder title="العملاء" icon="i-users" />;
}
