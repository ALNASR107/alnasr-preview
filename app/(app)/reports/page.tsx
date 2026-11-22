import type { Metadata } from 'next';
import SectionPlaceholder from '@/components/SectionPlaceholder';

export const metadata: Metadata = { title: 'التقارير' };

export default function Page() {
  return <SectionPlaceholder title="التقارير" icon="i-chart" />;
}
