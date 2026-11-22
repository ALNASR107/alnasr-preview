'use client';

import { useEffect, useState } from 'react';
import { Ic } from './Icons';

const KEY = 'amanah-theme';

export default function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let saved: 'light' | 'dark' | null = null;
    try {
      saved = (localStorage.getItem(KEY) as 'light' | 'dark' | null) ?? 'light';
    } catch {
      saved = 'light';
    }
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* الإطار المضمّن قد يمنع التخزين */
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className={className} onClick={toggle} title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'} aria-label="تبديل الوضع الليلي">
      <Ic n={theme === 'dark' ? 'i-sun' : 'i-moon'} />
    </button>
  );
}
