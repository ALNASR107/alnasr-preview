/**
 * تواريخ المنطقة الزمنية للتطبيق — كل «يوم» في الشيتات والتقارير يُحسب بتوقيتك
 * لا بتوقيت UTC (وإلا انتقلت حركة الساعة 1 بعد منتصف الليل إلى اليوم السابق).
 */
export const APP_TZ = process.env.APP_TZ || 'Asia/Damascus';

/** YYYY-MM-DD بتوقيت التطبيق */
export function dateInTz(d: Date | string = new Date()): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dt);
  } catch {
    return dt.toISOString().slice(0, 10);
  }
}

/** HH:mm بتوقيت التطبيق */
export function timeInTz(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

export function todayInTz(): string {
  return dateInTz(new Date());
}

/** التاريخ السابق/التالي بمقدار أيام */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dateInTz(d);
}

/** اسم يوم عربي قصير للعرض: «الخميس 20 تشرين الثاني» */
export function prettyDate(date: string): string {
  try {
    const d = new Date(`${date}T12:00:00Z`);
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d);
  } catch {
    return date;
  }
}
