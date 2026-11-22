import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginForm from '@/components/LoginForm';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--txt-3)' }}>جارٍ التحميل…</div>}>
      <LoginForm />
    </Suspense>
  );
}
