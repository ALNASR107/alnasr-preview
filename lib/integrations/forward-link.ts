/** التعرف المحافظ على زوج الرسائل: المرجع والرسالة كاملة متطابقان وهوية المرسِل مؤكدة. */
export type ForwardCandidate = { chat:string; messageId:string; date:string; text:string; senderPhone?:string };
export const FORWARDER = '905550639755';
export function referenceOf(text:string):string|undefined {
  const t = text.toUpperCase();
  const refs = [...new Set((t.match(/(?<![A-Z0-9])[A-Z]{2,8}\d{10,24}(?![A-Z0-9])/g) || []))];
  return refs.length === 1 ? refs[0] : undefined;
}
export function sameForwardedText(a:string,b:string):boolean {
  const canonical = (x:string) => x.normalize('NFKC').replace(/[\u200e\u200f\u061c\u200d\ufe0f]/g,'').replace(/\s+/g,' ').trim();
  return canonical(a) === canonical(b);
}
export function uniqueForwardPair<T extends ForwardCandidate>(items:T[], target:T):T|undefined {
  if (target.senderPhone !== FORWARDER || !target.chat.endsWith('@g.us')) return;
  const ref=referenceOf(target.text), time=Date.parse(target.date);
  if (!Number.isFinite(time)) return;
  const identical = items.filter(c => c.messageId && c.chat.endsWith('@g.us') && (!ref || referenceOf(c.text)===ref) && sameForwardedText(c.text,target.text) && Math.abs(Date.parse(c.date)-time)<=48*3600000);
  // طرف واحد فقط بكل جهة، وهوية الطرف الآخر مؤكدة ولم يُعرف كمرسل الرقم المعيد.
  if (identical.length !== 2) return;
  const origin=identical.find(c=>c.chat!==target.chat && c.senderPhone && c.senderPhone!==FORWARDER && Date.parse(c.date)<=time);
  return origin;
}
