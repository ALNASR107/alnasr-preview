import { NextResponse } from 'next/server';
import { listInbox } from '@/lib/integrations/wa-inbox';
import { waWebState, waGroupName } from '@/lib/integrations/wa-web';
import { ensureBoot } from '@/lib/boot';
import { listLines } from '@/lib/sheet';
import { getSheet } from '@/lib/sheets';
import { displayEntries, displayReactions, knownReactionEvents } from '@/lib/integrations/wa-display';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  ensureBoot();
  const original = listInbox();
  const archived = displayEntries();
  const lookup = new Map(original.filter(x => x.messageId).map(x => [`${x.chat}|${x.messageId}`, x]));
  const linked = new Map(listLines().filter(x=>x.linkMirror && x.linkedMessageId && x.sheetId).map(x=>[JSON.stringify([getSheet(x.sheetId!)?.jid,x.linkedMessageId]),x]));
  const archivedKeys = new Set(archived.map(x => `${x.chat}|${x.messageId}`));
  const displayed = archived.map(x => { const existing = lookup.get(`${x.chat}|${x.messageId}`); const mirror = linked.get(JSON.stringify([x.chat,x.messageId])); return { ...existing, ...x, ok: Boolean(mirror) || (existing?.ok ?? false), opId: mirror?.opId || existing?.opId }; });
  const old = original.filter(x => !x.messageId || !archivedKeys.has(`${x.chat}|${x.messageId}`));
  const reactions = new Map<string, {text:string; fromName:string}[]>();
  for (const r of displayReactions()) { const k = JSON.stringify([r.chat, r.targetId]); const list = reactions.get(k) || []; list.push({ text:r.text, fromName:r.fromName }); reactions.set(k,list); }
  const knownEvents = knownReactionEvents();
  const items = [...displayed, ...old].filter(item => !(item.messageId && item.text?.startsWith('[تفاعل]') && knownEvents.has(JSON.stringify([item.chat,item.messageId])))).map(item => {
    const actualName = waGroupName(item.chat);
    return { ...item, chatName: actualName || item.chatName, reactions: item.messageId ? reactions.get(JSON.stringify([item.chat,item.messageId])) || [] : [] }; 
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return NextResponse.json({ status: waWebState().status, items }, { headers: { 'Cache-Control': 'no-store' } });
}
