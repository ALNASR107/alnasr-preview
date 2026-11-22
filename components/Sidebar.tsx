'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ic } from './Icons';

type Item = { href: string; label: string; icon: string; badge?: number; group: string };

export default function Sidebar({
  pending,
  open = false,
  onClose,
}: {
  pending: number;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: '/dashboard', label: 'لوحة المتابعة', icon: 'i-grid', group: 'الرئيسية' },
    { href: '/operations', label: 'سجل العمليات', icon: 'i-list', badge: pending, group: 'الرئيسية' },
    { href: '/whatsapp', label: 'محادثات واتساب', icon: 'i-users', group: 'الرئيسية' },
    { href: '/sheet', label: 'شيت الترحيل', icon: 'i-file', group: 'المالية' },
    { href: '/reports', label: 'التقارير', icon: 'i-chart', group: 'المالية' },
    { href: '/accounts', label: 'الحسابات والصناديق', icon: 'i-wallet', group: 'المالية' },
    { href: '/clients', label: 'العملاء', icon: 'i-users', group: 'المالية' },
    { href: '/users', label: 'المستخدمون والصلاحيات', icon: 'i-shield', group: 'الإدارة' },
    { href: '/settings', label: 'الإعدادات', icon: 'i-cog', group: 'الإدارة' },
  ];

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-hidden={false}>
      <div className="brand">
        <div className="brand-mark"><Ic n="i-logo" style={{ width: 24, height: 24 }} /></div>
        <div className="brand-text">
          <b>شركة النصر</b>
          <span>للخدمات المالية والإدارية</span>
        </div>
        <button className="side-close" onClick={onClose} aria-label="إغلاق القائمة">
          <Ic n="i-x" sm />
        </button>
      </div>

      <div className="side-scroll">
        {groups.map((g) => (
          <div key={g}>
            <div className="nav-label">{g}</div>
            {items.filter((i) => i.group === g).map((i) => {
              const active = pathname === i.href || pathname.startsWith(i.href + '/');
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={onClose}
                  className={`nav-item ${active ? 'active' : ''}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Ic n={i.icon} />
                  {i.label}
                  {i.badge ? <span className="badge-count">{i.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="side-foot">
        <div className="side-card">
          <span className="dot-live" />
          <div>
            <small>الحالة</small>
            <b>متصل · آخر مزامنة الآن</b>
          </div>
        </div>
      </div>
    </aside>
  );
}
