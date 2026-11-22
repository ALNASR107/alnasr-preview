'use client';

import { useEffect } from 'react';
import type { Operation } from '@/lib/types';
import { STATUS_META } from '@/lib/types';
import { fmtDateTime, money } from '@/lib/format';
import { Ic } from './Icons';

type Props = {
  op: Operation | null;
  busy?: boolean;
  onClose: () => void;
  onPost: (op: Operation) => void;
  onToast: (msg: string, kind?: 'ok' | 'warn' | 'err' | 'info') => void;
};

export default function Drawer({ op, busy, onClose, onPost, onToast }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = !!op;
  const st = op ? STATUS_META[op.status] : null;

  const steps = op
    ? [
        { t: 'إنشاء العملية', d: fmtDateTime(op.date), done: true },
        { t: 'التحقق الآلي من البيانات', d: 'اكتمل بنجاح', done: true },
        {
          t: 'مراجعة المحاسب',
          d: op.status === 'review' ? 'بانتظار المراجعة' : op.status === 'pending' ? 'معلّقة بانتظار مستند' : 'تمت المراجعة',
          done: !['review', 'pending'].includes(op.status),
        },
        {
          t: 'الترحيل إلى دفتر اليومية',
          d: op.status === 'posted' ? 'تم الترحيل' : op.status === 'failed' ? 'فشل الترحيل — يلزم إعادة المحاولة' : 'لم يُرحّل بعد',
          done: op.status === 'posted',
        },
      ]
    : [];

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'show' : ''}`} aria-hidden={!open} role="dialog" aria-label="تفاصيل العملية">
        <div className="drawer-head">
          <h3>تفاصيل العملية</h3>
          <button className="x" onClick={onClose} aria-label="إغلاق">
            <Ic n="i-x" sm />
          </button>
        </div>

        {op && st && (
          <>
            <div className="drawer-body">
              <div className="d-hero">
                <div className="h-top">
                  <span className={`badge ${st.cls}`}>
                    <i />
                    {st.label}
                  </span>
                  <span className={`dir ${op.dir}`}>
                    <Ic n={op.dir === 'in' ? 'i-in' : 'i-out'} xs />
                    {op.dir === 'in' ? 'وارد' : 'صادر'}
                  </span>
                  <span className="muted num" style={{ marginInlineStart: 'auto', fontSize: 11.5 }}>{op.id}</span>
                </div>
                <div className="h-amount num" style={{ color: op.dir === 'in' ? 'var(--in)' : 'var(--out)' }}>
                  {money(op.amount)}
                  <span>{op.currency}</span>
                </div>
                <div className="h-meta">
                  {op.customer} · {op.note}
                </div>
              </div>

              <div className="kv">
                <div><small>نوع العملية</small><b>{op.type}</b></div>
                <div><small>الوسيلة</small><b>{op.method}</b></div>
                <div><small>التاريخ</small><b className="num">{fmtDateTime(op.date)}</b></div>
                <div><small>المرجع</small><b className="num">{op.ref}</b></div>
                <div><small>الحساب</small><b>{op.account}</b></div>
                <div><small>المستخدم</small><b>{op.user}</b></div>
              </div>

              <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--txt-2)' }}>سجل التتبّع</h4>
              <div className="tl">
                {steps.map((s) => (
                  <div key={s.t} className={`tl-item ${s.done ? 'done' : ''}`}>
                    <b>{s.t}</b>
                    <small>{s.d}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="drawer-foot">
              <button className="btn" onClick={() => onToast('تم إرسال العملية إلى الطباعة', 'info')}>
                <Ic n="i-print" sm /> طباعة
              </button>
              <button className="btn btn-primary" onClick={() => onPost(op)} disabled={busy}>
                <Ic n="i-check" sm /> {busy ? 'جارٍ الترحيل…' : op.status === 'posted' ? 'مرحّلة' : 'اعتماد وترحيل'}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
