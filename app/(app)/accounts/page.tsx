import type { Metadata } from 'next';
import SectionPlaceholder from '@/components/SectionPlaceholder';

export const metadata: Metadata = { title: 'الحسابات والصناديق' };

export default function Page() {
  return <SectionPlaceholder title="الحسابات والصناديق" icon="i-wallet" />;
}
