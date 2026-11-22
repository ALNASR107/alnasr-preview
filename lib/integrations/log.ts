/**
 * سجل أحداث التكامل (في الذاكرة — للعرض في صفحة الإعدادات).
 * في الإنتاج: استبدله بجدول IntegrationEvent في قاعدة البيانات.
 */
export type IntegrationEvent = {
  at: string;
  ch: 'whatsapp' | 'wakeed';
  ok: boolean;
  msg: string;
};

const MAX = 40;
let events: IntegrationEvent[] = [];

export function logEvent(e: Omit<IntegrationEvent, 'at'>): IntegrationEvent {
  const full: IntegrationEvent = { at: new Date().toISOString(), ...e };
  events = [full, ...events].slice(0, MAX);
  console.log(`[integration:${e.ch}] ${e.ok ? 'OK' : 'ERR'} — ${e.msg}`);
  return full;
}

export function recentEvents(limit = 8): IntegrationEvent[] {
  return events.slice(0, limit);
}
