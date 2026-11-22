import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AppShell from '@/components/AppShell';
import { allOperations } from '@/lib/mock';
import { ensureBoot } from '@/lib/boot';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  ensureBoot();
  const store = await cookies();
  const demo = process.env.DEMO_MODE === '1';
  if (!store.get('amanah_session') && !demo) redirect('/login');

  const userName = store.get('amanah_user')?.value || 'محمد الأحمد';
  const pending = allOperations().filter((o) => o.status === 'review' || o.status === 'pending').length;

  return (
    <AppShell pending={pending} userName={userName} role="مدير العمليات" demo={demo}>
      {children}
    </AppShell>
  );
}
