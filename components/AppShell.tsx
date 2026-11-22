'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/**
 * هيكل التطبيق: يحمل حالة فتح/إغلاق القائمة الجانبية على الشاشات الصغيرة.
 * الإغلاق بثلاث طرق: نقرة على الخلفية المعتمة، مفتاح Esc، زر × داخل القائمة
 * (وإغلاق تلقائي عند الانتقال إلى صفحة أخرى).
 */
export default function AppShell({
  pending,
  userName,
  role,
  demo,
  children,
}: {
  pending: number;
  userName: string;
  role: string;
  demo: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // عند فتح الموقع، معالجة الرسائل التي زامنها واتساب خلال آخر 48 ساعة.
  useEffect(() => { void fetch('/api/history-sync', { method: 'POST' }).catch(() => {}); }, []);

  // إغلاق تلقائي عند تغيير الصفحة
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc يغلق القائمة
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // منع تمرير الخلفية أثناء فتح القائمة
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="app">
      <Sidebar pending={pending} open={open} onClose={() => setOpen(false)} />
      {open && <div className="side-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="main">
        <Topbar userName={userName} role={role} demo={demo} onMenu={() => setOpen((v) => !v)} menuOpen={open} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
