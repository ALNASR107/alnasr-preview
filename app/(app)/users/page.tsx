import type { Metadata } from 'next';
import SectionPlaceholder from '@/components/SectionPlaceholder';

export const metadata: Metadata = { title: 'المستخدمون والصلاحيات' };

export default function Page() {
  return <SectionPlaceholder title="المستخدمون والصلاحيات" icon="i-shield" />;
}
