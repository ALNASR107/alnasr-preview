'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Issue = { at:string; chatName:string; text:string; reason:string; messageId:string; chat:string };
type Status = { connected:boolean; available:number; pending:number; issues:Issue[]; note:string };
export default function HistoryStatus() {
  const [data,setData]=useState<Status|null>(null); const [open,setOpen]=useState(false);
  useEffect(()=>{ let live=true; const load=async()=>{try{const r=await fetch('/api/history-sync',{cache:'no-store'});if(r.ok && live)setData(await r.json());}catch{}}; void load();const timer=setInterval(load,15000);return()=>{live=false;clearInterval(timer)};},[]);
  return <div className="card" style={{padding:'12px 15px',marginBottom:14,fontSize:12.5,lineHeight:1.8}}><b>مزامنة آخر ٤٨ ساعة:</b> {!data?'جارٍ التحقق…':!data.connected?'اربط واتساب أولاً':`${data.available} حركة محتملة متاحة · ${data.pending} بانتظار المعالجة`} <span style={{color:'var(--txt-3)'}}>· المتاح فقط من واتساب، وقد يكون غير مكتمل.</span>{Boolean(data?.issues.length)&&<><button className="btn btn-sm" style={{marginInlineStart:10}} onClick={()=>setOpen(!open)}>{open?'إخفاء المراجعة':`حالات للمراجعة (${data?.issues.length})`}</button>{open&&<div style={{maxHeight:240,overflow:'auto',marginTop:10}}>{data?.issues.map(i=><div key={`${i.chat}-${i.messageId}`} style={{borderTop:'1px solid var(--line)',padding:'8px 0'}}><b>{i.chatName}</b> · {i.reason}<div style={{whiteSpace:'pre-wrap'}}>{i.text}</div></div>)}<Link href="/operations">فتح سجل العمليات</Link></div>}</>}</div>;
}
