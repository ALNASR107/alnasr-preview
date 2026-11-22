/**
 * إقلاع مكوّنات الخلفية (داخل عملية Node الدائمة فقط).
 *
 * لم نستخدم `instrumentation.ts` لأن Next يجمّعه أيضًا لبيئة edge،
 * ومكتبة واتساب (Baileys) لا تعمل إلا على Node. لذلك نستدعي `ensureBoot()`
 * من أول موديول يُحمَّل على السيرفر (فحص الصحة أو تخطيط الصفحات)، وهي دالة idempotent.
 */
import { startAutoPost } from '@/lib/auto-post';

const g = globalThis as unknown as { __amanahBooted?: boolean };

export function ensureBoot(): void {
  if (g.__amanahBooted) return;
  g.__amanahBooted = true;

  try {
    startAutoPost();
  } catch (err) {
    console.error('[boot] تعذّر تشغيل الترحيل التلقائي:', err);
  }

  // استئناف جلسة واتساب المحفوظة بعد إعادة التشغيل
  if ((process.env.WA_AUTO_CONNECT ?? '1') !== '0') {
    import('@/lib/integrations/wa-web')
      .then((m) => {
        if (m.hasStoredSession()) {
          console.log('[boot] استئناف جلسة واتساب المحفوظة…');
          return m.startWaWeb();
        }
      })
      .catch((err) => console.error('[boot] واتساب:', err));
  }

  console.log('[boot] تم إقلاع مكوّنات الخلفية');
}
