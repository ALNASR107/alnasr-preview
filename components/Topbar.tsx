'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Ic } from './Icons';
import ThemeToggle from './ThemeToggle';
import { useToast } from './Toaster';

const TITLES: Record<string, string> = {
  '/dashboard': 'لوحة المتابعة',
  '/operations': 'العمليات',
  '/sheet': 'شيت الترحيل',
  '/reports': 'التقارير',
  '/accounts': 'الحسابات والصناديق',
  '/clients': 'العملاء',
  '/users': 'المستخدمون والصلاحيات',
  '/settings': 'الإعدادات',
};

export default function Topbar({
  userName,
  role,
  demo,
  onMenu,
  menuOpen,
}: {
  userName: string;
  role: string;
  demo?: boolean;
  onMenu?: () => void;
  menuOpen?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const [q, setQ] = useState(params.get('q') ?? '');
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const title = TITLES[pathname] ?? 'شركة النصر';

  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  function onSearch(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const sp = new URLSearchParams(pathname === '/operations' ? Array.from(params.entries()) : []);
      if (value.trim()) sp.set('q', value.trim());
      else sp.delete('q');
      router.replace(`${pathname === '/operations' ? '/operations' : '/operations'}?${sp.toString()}`);
    }, 350);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') setMenu(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function doLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast('تم تسجيل الخروج', 'info');
    router.push('/login');
    router.refresh();
  }

  const initials = userName.split(' ').map((s) => s[0]).join('').slice(0, 2);

  return (
    <header className="topbar">
      <button
        className="hamburger"
        aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
        aria-expanded={Boolean(menuOpen)}
        onClick={() => onMenu?.()}
      >
        <Ic n={menuOpen ? 'i-x' : 'i-menu'} />
      </button>

      <div className="crumbs">
        <span className="muted-crumb">شركة النصر</span>
        <span className="sep">/</span>
        <span className="muted-crumb">المالية</span>
        <span className="sep">/</span>
        <b>{title}</b>
      </div>

      {demo && (
        <span
          className="badge pending"
          title="وضع المعاينة: الدخول غير محمي (DEMO_MODE=1). أوقفه في الإنتاج."
          style={{ marginInlineStart: 6, whiteSpace: 'nowrap' }}
        >
          <i /> وضع المعاينة
        </span>
      )}

      <div className="search">
        <Ic n="i-search" sm className="s-icon" />
        <input
          ref={inputRef}
          type="search"
          placeholder="ابحث برقم العملية، العميل، أو المرجع…"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="بحث"
        />
        <kbd>/</kbd>
      </div>

      <div className="topbar-divider" />
      <ThemeToggle />
      <button className="icon-btn" title="التنبيهات" onClick={() => toast('لديك عمليات بحاجة إلى مراجعة', 'warn')}>
        <Ic n="i-bell" />
        <span className="ping" />
      </button>

      <div style={{ position: 'relative' }}>
        <button className="user-chip" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
          <div className="avatar">{initials}</div>
          <div className="u-meta">
            <b>{userName}</b>
            <small>{role}</small>
          </div>
          <Ic n="i-chev-l" xs style={{ transform: 'rotate(-90deg)', opacity: 0.5 }} />
        </button>

        {menu && (
          <div
            className="card"
            style={{ position: 'absolute', top: 'calc(100% + 8px)', insetInlineEnd: 0, width: 210, padding: 6, zIndex: 60, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-soft)' }}>
              <b style={{ fontSize: 12.5 }}>{userName}</b>
              <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{role}</div>
            </div>
            <button className="nav-item" style={{ color: 'var(--txt-2)' }} onClick={doLogout}>
              <Ic n="i-logout" sm /> تسجيل الخروج
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
