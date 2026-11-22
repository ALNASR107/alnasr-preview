import { NextRequest, NextResponse } from 'next/server';
import {
  allOperations,
  computeKpis,
  filterOperations,
  sortOperations,
  statusCounts,
} from '@/lib/mock';
import type { OperationsQuery, SortDir, SortKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operations?q=&status=posted,review&type=&method=&dir=&from=&to=&sort=&order=&page=&perPage=
 * يعيد { rows, total, allTotal, page, perPage, pages, statusCounts, kpis }
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const query: OperationsQuery = {
    q: sp.get('q') ?? undefined,
    status: (sp.get('status') ?? '').split(',').filter(Boolean),
    type: sp.get('type') || undefined,
    method: sp.get('method') || undefined,
    dir: sp.get('dir') || undefined,
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
  };

  const sort = (sp.get('sort') as SortKey) || 'date';
  const order = (sp.get('order') as SortDir) || 'desc';
  const page = Math.max(1, Number(sp.get('page') ?? 1));
  const perPage = Math.min(500, Math.max(1, Number(sp.get('perPage') ?? 12)));

  const all = allOperations();
  const filtered = filterOperations(all, query);
  const sorted = sortOperations(filtered, sort, order);
  const rows = sorted.slice((page - 1) * perPage, page * perPage);
  const pages = Math.max(1, Math.ceil(sorted.length / perPage));

  return NextResponse.json({
    rows,
    total: sorted.length,
    allTotal: all.length,
    page: Math.min(page, pages),
    perPage,
    pages,
    statusCounts: statusCounts(filtered),
    kpis: computeKpis(filtered),
  });
}
