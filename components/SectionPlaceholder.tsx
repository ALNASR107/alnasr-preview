import Link from 'next/link';
import { Ic } from './Icons';

export default function SectionPlaceholder({
  title,
  icon,
  note,
}: {
  title: string;
  icon: string;
  note?: string;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{note ?? 'القسم جاهز للربط ببياناتك — نفس المكوّنات والأنماط المستخدمة في سجل العمليات'}</p>
        </div>
        <div className="head-actions">
          <Link className="btn" href="/operations"><Ic n="i-list" sm /> سجل العمليات</Link>
        </div>
      </div>
      <div className="card">
        <div className="ph">
          <div className="ph-ic"><Ic n={icon} style={{ width: 28, height: 28 }} /></div>
          <b>{title}</b>
          <div style={{ marginTop: 5, fontSize: 13, maxWidth: 460 }}>
            أنشئ ملف <code>app/(app)/{'{'}القسم{'}'}/page.tsx</code> واستدعِ <code>components/OperationsView.tsx</code>
            أو مكوّنات <code>KpiRow</code> / <code>AreaChart</code> / <code>Donut</code> لعرض بياناتك.
          </div>
        </div>
      </div>
    </>
  );
}
