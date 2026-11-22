/**
 * طبقة الوصول للبيانات من جهة العميل.
 * كل الطلبات تمرّ عبر /api/* — ولتحويلها إلى خادمك الحقيقي يكفي ضبط
 * NEXT_PUBLIC_API_BASE أو إضافة rewrite في next.config.mjs.
 */
import type { Operation, OperationsQuery, OperationsResponse, SummaryResponse, OperationStatus } from '@/lib/types';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

export function buildQuery(q: OperationsQuery): string {
  const p = new URLSearchParams();
  if (q.q) p.set('q', q.q);
  if (q.status?.length) p.set('status', q.status.join(','));
  if (q.type) p.set('type', q.type);
  if (q.method) p.set('method', q.method);
  if (q.dir) p.set('dir', q.dir);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.sort) p.set('sort', q.sort);
  if (q.order) p.set('order', q.order);
  if (q.page) p.set('page', String(q.page));
  if (q.perPage) p.set('perPage', String(q.perPage));
  return p.toString();
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = 'تعذّر إكمال الطلب';
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function fetchOperations(q: OperationsQuery, signal?: AbortSignal) {
  return json<OperationsResponse>(`${API_BASE}/operations?${buildQuery(q)}`, { signal });
}

export function fetchSummary(days = 14, signal?: AbortSignal) {
  return json<SummaryResponse>(`${API_BASE}/summary?days=${days}`, { signal });
}

export function updateOperationStatus(id: string, status: OperationStatus) {
  return json<{ operation: Operation }>(`${API_BASE}/operations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function login(email: string, password: string) {
  return json<{ ok: true; user: { name: string; role: string; email: string } }>(
    `${API_BASE}/auth/login`,
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
}

export function logout() {
  return json<{ ok: true }>(`${API_BASE}/auth/logout`, { method: 'POST' });
}
