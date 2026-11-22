import { Suspense } from 'react';
import type { Metadata } from 'next';
import OperationsView from '@/components/OperationsView';

export const metadata: Metadata = { title: 'العمليات' };

export default function OperationsPage() {
  return (
    <Suspense fallback={<div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--txt-3)' }}>جارٍ التحميل…</div>}>
      <OperationsView />
    </Suspense>
  );
}
