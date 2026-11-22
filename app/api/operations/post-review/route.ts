import { NextResponse } from 'next/server';
import { allOperations } from '@/lib/mock';
import { postToSheet } from '@/lib/sheet';
export const dynamic='force-dynamic';
export const runtime='nodejs';
/** قائمة ثابتة للتأكيد، بغض النظر عن فلاتر الصفحة. */
export async function GET() {
  const ops=allOperations().filter(o=>o.status==='review');
  return NextResponse.json({ids:ops.map(o=>o.id),count:ops.length},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request) {
  const body=await req.json().catch(()=>({}));
  if (!Array.isArray(body.ids) || body.ids.length>10000 || body.ids.some((x:unknown)=>typeof x!=='string')) return NextResponse.json({error:'قائمة الحركات غير صالحة'},{status:400});
  const ids=[...new Set(body.ids as string[])];
  const eligible=new Set(allOperations().filter(o=>o.status==='review').map(o=>o.id));
  const valid=ids.filter(id=>eligible.has(id));
  // لا نرسل رسائل أو نستخدم تكاملات خارجية.
  const result=postToSheet(valid);
  return NextResponse.json({...result,changed:ids.length-valid.length});
}
