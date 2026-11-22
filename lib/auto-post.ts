/** ترحيل العمليات المؤهلة دورياً دون إرسال أي رسالة أو ملخّص. */
import { postAllPending, pendingForSheet, sheetTotals } from '@/lib/sheet';
import { sendWaWebText, waWebConnected, waWebState, hasStoredSession, startWaWeb } from '@/lib/integrations/wa-web';

type Run = {
  at: string;
  added: number;
  skipped: number;
  errors: number;
  waSent: boolean;
  note?: string;
};

const g = globalThis as unknown as {
  __amanahAutoPost?: { timer?: NodeJS.Timeout; startedAt?: string; runs: Run[]; runs_total?: number };
};
const state = (g.__amanahAutoPost ??= { runs: [] });

export function autoPostEnabled() {
  return (process.env.AUTO_POST_ENABLED ?? '1') !== '0';
}

export function autoPostIntervalMin() {
  const n = Number(process.env.AUTO_POST_INTERVAL_MIN ?? 10);
  return Number.isFinite(n) && n >= 1 ? n : 10;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/** دورة ترحيل واحدة */
export async function runAutoPost(reason = 'schedule'): Promise<Run> {
  const pending = pendingForSheet();
  const opts = process.env.AUTO_POST_COST_CENTER ? { costCenter: process.env.AUTO_POST_COST_CENTER } : undefined;
  const res = postAllPending(opts);

  // لا نرسل أي ملخص أو رسالة تلقائياً.
  const waSent = false;
  const note: string | undefined = undefined;

  const run: Run = {
    at: new Date().toISOString(),
    added: res.added,
    skipped: res.skipped,
    errors: res.errors.length,
    waSent,
    note,
  };
  state.runs = [run, ...state.runs].slice(0, 20);
  state.runs_total = (state.runs_total ?? 0) + 1;

  console.log(
    `[auto-post:${reason}] +${run.added} تمت إضافتها، ${run.skipped} مكرّرة، ${run.errors} خطأ` +
      (note ? ` — ${note}` : '') +
      (waSent ? ' — أُرسل ملخّص واتساب' : ''),
  );
  return run;
}

/** تشغيل المجدول مرة واحدة فقط لكل عملية (آمن مع hot reload) */
export function startAutoPost() {
  if (!autoPostEnabled()) {
    console.log('[auto-post] معطّل (AUTO_POST_ENABLED=0)');
    return;
  }
  if (state.timer) return;

  state.startedAt = new Date().toISOString();
  const everyMs = autoPostIntervalMin() * 60_000;

  const tick = () => {
    runAutoPost().catch((err) => console.error('[auto-post] فشل الدورة:', err));
  };

  state.timer = setInterval(tick, everyMs);
  // لا يُبقي المجدول العملية مستيقظة عند الإيقاف
  state.timer.unref?.();

  if ((process.env.AUTO_POST_ON_START ?? '1') !== '0') {
    setTimeout(tick, 8_000); // مهلة قصيرة حتى يكتمل إقلاع Next
  }

  console.log(`[auto-post] يعمل كل ${autoPostIntervalMin()} دقيقة`);
}

export function autoPostState() {
  return {
    enabled: autoPostEnabled(),
    intervalMin: autoPostIntervalMin(),
    running: Boolean(state.timer),
    startedAt: state.startedAt ?? null,
    totalRuns: state.runs_total ?? 0,
    lastRuns: state.runs,
    summaryTo: process.env.WA_AUTO_SUMMARY_TO ? 'مضبوط' : 'غير مضبوط',
    costCenter: process.env.AUTO_POST_COST_CENTER ?? null,
  };
}
