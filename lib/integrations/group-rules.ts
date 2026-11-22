import { readJson, writeJson } from '@/lib/store';
export type GroupMode = 'text' | 'images' | 'off';
const key = 'wa-group-rules';
const g = globalThis as unknown as { __nasrGroupRules?: Record<string, GroupMode> };
const rules = (g.__nasrGroupRules ??= readJson<Record<string, GroupMode>>(key, {}));
function savedRules() { return readJson<Record<string, GroupMode>>(key, {}); }
export function groupMode(jid: string): GroupMode { return jid.endsWith('@g.us') ? savedRules()[jid] ?? 'text' : 'text'; }
export function groupRules() { return { ...savedRules() }; }
export function setGroupMode(jid: string, mode: GroupMode) { const next = { ...savedRules(), [jid]: mode }; if (!writeJson(key, next)) throw new Error('تعذّر حفظ الإعدادات'); Object.assign(rules, next); }


/** إعداد العملة مستقل عن نوع الرسائل؛ الافتراضي يحافظ على العملة الأصلية. */
export type GroupCurrencyMode = 'original' | 'usd';
const currencyKey = 'wa-group-currency-rules';
export function groupCurrencyRules(): Record<string, GroupCurrencyMode> { return readJson<Record<string, GroupCurrencyMode>>(currencyKey, {}); }
export function groupCurrencyMode(jid: string): GroupCurrencyMode { return groupCurrencyRules()[jid] === 'usd' ? 'usd' : 'original'; }
export function setGroupCurrencyMode(jid: string, mode: GroupCurrencyMode) {
  const next = { ...groupCurrencyRules(), [jid]: mode };
  if (!writeJson(currencyKey, next)) throw new Error('تعذر حفظ عملة المجموعة');
}
