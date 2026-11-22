'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ic } from './Icons';
import ThemeToggle from './ThemeToggle';
import { useToast } from './Toaster';
import { login } from '@/lib/api';

type FieldErr = { email?: boolean; password?: boolean };

export default function LoginForm() {
  const params = useSearchParams();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErr>({});
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      try { const saved = localStorage.getItem('amanah-user');
      if (saved && localStorage.getItem('amanah-remember') !== '0') setEmail(saved); } catch { /* قد يُمنع التخزين */ }
    } catch {
      /* ignore */
    }
    if (window.matchMedia('(min-width: 1021px)').matches) emailRef.current?.focus();
  }, []);

  function validate(): boolean {
    const e: FieldErr = {};
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || /^[a-zA-Z0-9._-]{3,}$/.test(email.trim());
    if (!emailOk) e.email = true;
    if (password.length < 4) e.password = true;
    setErrors(e);
    return !e.email && !e.password;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setAlert('');
    if (!validate()) return;

    setLoading(true);

    // شبكة أمان: لا نترك الزر في حالة تحميل إلى ما لا نهاية
    const guard = setTimeout(() => {
      setLoading(false);
      setAlert('استغرق الدخول وقتًا أطول من المتوقع. تحقّق من الاتصال ثم أعد المحاولة.');
    }, 12000);

    try {
      await login(email.trim(), password);
      try {
        try {
          localStorage.setItem('amanah-user', email.trim().split('@')[0]);
          localStorage.setItem('amanah-remember', remember ? '1' : '0');
        } catch {
          /* تجاهل */
        }
      } catch {
        /* الكوكيز/التخزين قد تكون محظورة داخل إطار مضمّن */
      }

      // هل نجح حفظ الجلسة فعلًا في هذا المتصفح؟
      const session = await fetch('/api/auth/session', { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => null);

      if (!session?.authenticated && !session?.demo) {
        clearTimeout(guard);
        setLoading(false);
        setAlert(
          'نجح التحقّق، لكن المتصفح منع حفظ الجلسة (كوكيز محظورة أو عرض داخل إطار مضمّن). افتح المنصّة في نافذة مستقلة ثم أعد المحاولة.',
        );
        toast('تعذّر حفظ الجلسة في هذا المتصفح', 'err');
        return;
      }

      toast('مرحباً بك، جارٍ فتح لوحة العمليات…');
      const next = params.get('next') || '/operations';
      clearTimeout(guard);
      // تنقّل كامل: يضمن أن الخادم يقرأ الكوكي في أول طلب
      window.location.assign(next);
    } catch (e) {
      clearTimeout(guard);
      setLoading(false);
      setAlert((e as Error).message);
      setErrors({ password: true });
      toast('تعذّر تسجيل الدخول', 'err');
    }
  }

  function fillDemo() {
    setEmail('admin@alnasr.com');
    setPassword('1234');
    setErrors({});
    setAlert('');
  }

  return (
    <div className="auth-root">
      <div className="auth-wrap">
        {/* ---------- لوحة العرض ---------- */}
        <section className="auth-show">
          <div className="auth-sc-top">
            <div className="auth-mark"><Ic n="i-logo" style={{ width: 26, height: 26 }} /></div>
            <div>
              <b>شركة النصر</b>
              <span>للخدمات المالية والإدارية</span>
            </div>
          </div>

          <div className="auth-mid">
            <span className="auth-eyebrow"><i /> منصّة العمليات المالية</span>
            <h1>كل حركة مالية،<br />تحت السيطرة <em>لحظة بلحظة</em>.</h1>
            <p>سجل موحّد للوارد والصادر، مراجعة دقيقة قبل الترحيل، وتقارير جاهزة للتصدير — من مكان واحد.</p>

            <ul className="auth-list">
              <li>
                <span className="li-ic"><Ic n="i-bolt" sm /></span>
                <div><b>متابعة لحظية</b><span>تحديث فوري لكل عملية مع تنبيه لما يحتاج إجراءً</span></div>
              </li>
              <li>
                <span className="li-ic"><Ic n="i-shield" sm /></span>
                <div><b>صلاحيات دقيقة</b><span>كل مستخدم يرى ما يخصّه فقط، مع سجل تتبّع كامل</span></div>
              </li>
              <li>
                <span className="li-ic"><Ic n="i-chart" sm /></span>
                <div><b>تقارير جاهزة</b><span>مؤشرات وحركة الوارد والصادر وتصدير CSV بنقرة</span></div>
              </li>
            </ul>
          </div>

          <div className="auth-bottom">
            <div className="auth-stat"><small>مصدر الحركات</small><b style={{ fontSize: 15 }}>واتساب <span>مباشرة</span></b></div>
            <div className="auth-stat"><small>الشيتات</small><b style={{ fontSize: 15 }}>لكل محادثة <span>وليوم</span></b></div>
            <div className="auth-stat">
              <small>الحالة</small>
              <b style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38d39f', boxShadow: '0 0 0 4px rgba(56,211,159,.22)' }} />
                متصل
              </b>
            </div>
          </div>
        </section>

        {/* ---------- النموذج ---------- */}
        <section className="auth-side">
          <div className="auth-top">
            <div className="auth-mobile-brand">
              <span className="bm"><Ic n="i-logo" style={{ width: 20, height: 20 }} /></span>
              شركة النصر
            </div>
            <a className="auth-help" href="#" onClick={(e) => e.preventDefault()}>
              <Ic n="i-help" sm /> بحاجة إلى مساعدة؟
            </a>
            <ThemeToggle />
          </div>

          <div className="auth-center">
            <form className="auth-card" onSubmit={onSubmit} noValidate>
              <h2>تسجيل الدخول</h2>
              <p className="sub">أدخل بيانات حسابك للوصول إلى لوحة العمليات.</p>

              {alert && (
                <div className="auth-alert">
                  <Ic n="i-alert" sm style={{ marginTop: 1 }} />
                  <span>{alert}</span>
                </div>
              )}

              <button type="button" className="auth-btn" onClick={() => toast('الدخول عبر Google يحتاج ربط حساب المنصّة', 'err')}>
                <svg className="g-icon" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.2C12.3 13.5 17.6 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.5c-.3 2.1-1.6 5.2-4.6 7.3l7.7 6c4.5-4.2 6.5-10.3 6.5-17.6z" />
                  <path fill="#FBBC05" d="M10.4 28.6a14.6 14.6 0 0 1 0-9.2l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l7.9-6.2z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.6-5.8l-7.7-6c-2.1 1.4-4.8 2.4-7.9 2.4-6.4 0-11.7-4-13.6-9.9l-7.9 6.2C6.4 42.6 14.6 48 24 48z" />
                </svg>
                المتابعة عبر Google
              </button>

              <div className="auth-or">أو بالبريد الإلكتروني</div>

              <div className={`auth-field ${errors.email ? 'err' : ''}`}>
                <label htmlFor="email">البريد الإلكتروني أو اسم المستخدم</label>
                <div className="auth-control">
                  <Ic n="i-mail" sm className="lead" />
                  <input
                    id="email"
                    ref={emailRef}
                    type="text"
                    dir="ltr"
                    inputMode="email"
                    placeholder="name@alnasr.com"
                    autoComplete="username"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: false })); setAlert(''); }}
                  />
                </div>
                <div className="msg"><Ic n="i-alert" sm /><span>أدخل بريدًا إلكترونيًا صحيحًا.</span></div>
              </div>

              <div className={`auth-field ${errors.password ? 'err' : ''}`}>
                <label htmlFor="password">كلمة المرور</label>
                <div className="auth-control">
                  <Ic n="i-lock" sm className="lead" />
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: false })); setAlert(''); }}
                  />
                  <button
                    type="button"
                    className="tail"
                    onClick={() => setShowPass((v) => !v)}
                    title={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    aria-label="إظهار كلمة المرور"
                  >
                    <Ic n={showPass ? 'i-eye-off' : 'i-eye'} sm />
                  </button>
                </div>
                <div className="msg"><Ic n="i-alert" sm /><span>كلمة المرور مطلوبة — 4 أحرف على الأقل.</span></div>
              </div>

              <div className="auth-row">
                <label className="auth-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span className="box"><svg><use href="#i-check" /></svg></span>
                  تذكّرني على هذا الجهاز
                </label>
                <a className="auth-link" href="#" onClick={(e) => { e.preventDefault(); toast('سيصلك رابط إعادة التعيين على بريدك'); }}>
                  نسيت كلمة المرور؟
                </a>
              </div>

              <button type="submit" className="auth-btn auth-btn-primary" disabled={loading}>
                {loading && <span className="auth-spin" />}
                {loading ? 'جارٍ التحقق…' : 'دخول إلى لوحة العمليات'}
              </button>

              <div className="auth-demo">
                <span>بيانات تجريبية:</span>
                <b>admin@alnasr.com</b>
                <span style={{ opacity: 0.6 }}>/</span>
                <b>1234</b>
                <button type="button" className="fill" onClick={fillDemo}>تعبئة تلقائية</button>
              </div>
            </form>
          </div>

          <div className="auth-foot">
            © 2026 شركة النصر للخدمات المالية والإدارية
            <span className="sep">·</span>
            <a href="#" onClick={(e) => e.preventDefault()}>سياسة الخصوصية</a>
          </div>
        </section>
      </div>
    </div>
  );
}
