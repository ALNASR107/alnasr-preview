/** دوال تنسيق مشتركة (تُستخدم على الخادم والعميل) */

export const CURRENCY = 'ل.س';

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export const money = (n: number) => nf.format(n);

export const num = (n: number) => nf.format(n);

export function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' مليار';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' مليون';
  if (n >= 1e3) return Math.round(n / 1e3) + ' ألف';
  return String(n);
}

export const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const ampm = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${h12}:${pad(d.getMinutes())} ${ampm}`;
}

export function esc(v: unknown): string {
  return String(v).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
