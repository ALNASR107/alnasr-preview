'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Ic } from './Icons';

type Kind = 'ok' | 'warn' | 'err' | 'info';
type Item = { id: number; msg: string; kind: Kind };
type Push = (msg: string, kind?: Kind) => void;

const ToastCtx = createContext<Push>(() => {});
export const useToast = () => useContext(ToastCtx);

const ICONS: Record<Kind, string> = { ok: 'i-check', warn: 'i-clock', err: 'i-x', info: 'i-alert' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const push = useCallback<Push>((msg, kind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'ok' ? '' : t.kind}`}>
            <span className="t-ic">
              <Ic n={ICONS[t.kind]} sm />
            </span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
