/** مزامنة الرسائل المتاحة من واتساب لآخر 48 ساعة. واتساب لا يضمن إرسال السجل كاملاً. */
import { readJson, writeJson } from '@/lib/store';
import { dateInTz, shiftDate, todayInTz } from '@/lib/dates';
import { allOperations } from '@/lib/mock';
import { ingestMessage, parseOperationText, parseConfirmedVodafone, parseLana, parseAmountCurrency, postingBlockReason } from './wa-inbox';
import { groupMode, groupCurrencyMode } from './group-rules';
import { historySenderPhone, groupSenderPhone, senderDirection } from './sender-direction';
import { archiveDisplayMessage } from './wa-display';
import { parseRateBulletin, recordBulletin, groupPostingAmount } from './group-fx';
import { referenceOf, uniqueForwardPair } from './forward-link';
import { linkGroupMirror } from '@/lib/sheet';

type Candidate = { owner: string; chat: string; messageId: string; date: string; text: string; chatName: string; fromName: string; senderPhone?: string; fromMe?: boolean };
type Issue = { owner: string; at: string; chatName: string; text: string; reason: string; messageId: string; chat: string };
const g = globalThis as unknown as { __nasrHistory?: Candidate[]; __nasrHistorySeen?: Record<string,string>; __nasrHistoryIssues?: Issue[]; __nasrHistoryTimer?: NodeJS.Timeout; __nasrHistoryOwner?: string };
let items = (g.__nasrHistory ??= readJson<Candidate[]>('wa-history', []));
const seen = (g.__nasrHistorySeen ??= readJson<Record<string,string>>('wa-history-seen', {}));
let issues = (g.__nasrHistoryIssues ??= readJson<Issue[]>('wa-history-review', []));
function save() { g.__nasrHistory = items; writeJson('wa-history', items); }
const key = (c: Candidate) => `${c.owner}|${c.chat}|${c.messageId}`;
function wasProcessed(c: Candidate) { return Boolean(seen[key(c)]) || allOperations().some(o => o.waMessageId === c.messageId && o.chatJid === c.chat); }
function allowed(c: Candidate) { return groupMode(c.chat) === 'text' && (process.env.WA_INGEST_ENABLED ?? '1') !== '0' && (!c.chat.endsWith('@g.us') || (process.env.WA_INGEST_GROUPS ?? '1') !== '0') && (!c.fromMe || (process.env.WA_INGEST_FROM_ME ?? '1') !== '0'); }
function parse(c: Candidate) { if (parseRateBulletin(c.text).length || postingBlockReason(c.text)) return undefined; return parseOperationText(c.text) || (c.chat.endsWith('@g.us') ? parseLana(c.text) || parseConfirmedVodafone(c.text) || parseAmountCurrency(c.text) : undefined); }
function within48(date: string) { const t = Date.parse(date); return Number.isFinite(t) && t >= Date.now() - 48 * 3600000 && t <= Date.now() + 60000; }
function saveSeen(c: Candidate, state: string) { seen[key(c)] = state; writeJson('wa-history-seen', seen); }
function flag(c: Candidate, reason: string) { if (!issues.some(i => i.chat === c.chat && i.messageId === c.messageId)) { issues = [{ owner:c.owner, at:c.date, chatName:c.chatName || c.chat, text:c.text.slice(0,1000), reason, messageId:c.messageId, chat:c.chat }, ...issues].slice(0,1000); g.__nasrHistoryIssues = issues; writeJson('wa-history-review', issues); } }
export async function cacheHistory(messages: any[], owner: string, names: Record<string,string> = {}, sock?: any) {
  if (!owner) return;
  g.__nasrHistoryOwner = owner;
  const keys = new Set(items.map(key)); let added = 0;
  for (const m of messages || []) {
    const chat = String(m?.key?.remoteJid || ''), messageId = String(m?.key?.id || ''), sec = Number(m?.messageTimestamp);
    if (!chat || !messageId || !Number.isFinite(sec) || sec <= 0 || (!chat.endsWith('@g.us') && !chat.endsWith('@s.whatsapp.net') && !chat.endsWith('@lid'))) continue;
    const dt = new Date(sec * 1000); if (!Number.isFinite(dt.getTime()) || !within48(dt.toISOString())) continue;
    const name = names[chat] || (chat.endsWith('@g.us') ? `مجموعة ${chat.split('@')[0]}` : String(m.pushName || `محادثة ${chat.split('@')[0]}`));
    // العرض منفصل عن الترحيل؛ لن يرسل رسائل، والوسائط قد لا تتوفر للمزامنة.
    void archiveDisplayMessage(m, name).catch(() => {});
    const text = String(m?.message?.conversation ?? m?.message?.extendedTextMessage?.text ?? '');
    if (text && chat.endsWith('@g.us') && groupMode(chat) !== 'off' && parseRateBulletin(text).length) recordBulletin({chat, text, messageId, at:dt.toISOString()});
    const c: Candidate = { owner, chat, messageId, date:dt.toISOString(), text, chatName:name, fromName:String(m.pushName || ''), senderPhone:chat.endsWith('@g.us') ? (historySenderPhone(m, owner) || (sock ? await groupSenderPhone(m, sock) : undefined)) : undefined, fromMe:Boolean(m.key.fromMe) };
    if (!text) continue;
    const existing = items.find(existing => key(existing) === key(c));
    if (existing) {
      if (!existing.senderPhone && c.senderPhone) {
        existing.senderPhone = c.senderPhone;
        if (seen[key(c)] === 'unknown-sender') { delete seen[key(c)]; writeJson('wa-history-seen', seen); }
        added++;
      }
      continue;
    }
    keys.add(key(c)); items.push(c); added++;
  }
  if (added) save();
}
export function processHistory(owner: string, onlyDate?: string) {
  // نفحص نشرات التاريخ المحفوظة قبل الحركات حتى يُستخدم السعر السابق لها زمنياً.
  for (const c of items) if (c.owner === owner && within48(c.date) && c.chat.endsWith('@g.us') && groupMode(c.chat) !== 'off' && parseRateBulletin(c.text).length) recordBulletin({chat:c.chat,text:c.text,messageId:c.messageId,at:c.date});
  const batch = items.filter(c => c.owner === owner && within48(c.date) && allowed(c) && (!onlyDate || dateInTz(c.date) === onlyDate) && !wasProcessed(c) && Boolean(parse(c))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  let added=0, review=0, skipped=0;
  const candidates = items.filter(c=>c.owner===owner && within48(c.date) && allowed(c));
  for (const target of candidates) {
    if (wasProcessed(target) || !parse(target)) continue;
    const origin = uniqueForwardPair(candidates,target);
    if (!origin || !parse(origin) || !senderDirection(origin.senderPhone) || !senderDirection(target.senderPhone)) continue;
    if (onlyDate && (dateInTz(origin.date) !== onlyDate || dateInTz(target.date) !== onlyDate)) continue;
    const amount = parse(target)!;
    if (!groupPostingAmount(origin.chat, amount.currency, amount.amount, origin.date, groupCurrencyMode(origin.chat)) || !groupPostingAmount(target.chat, amount.currency, amount.amount, target.date, groupCurrencyMode(target.chat))) continue;
    // طرف ثالث بنفس القيمة والعملة غير مضمون؛ يبقى للمراجعة ولا نختار آلياً.
    if (candidates.some(c => c !== origin && c !== target && c.chat !== origin.chat && c.chat !== target.chat && parse(c)?.amount === amount.amount && parse(c)?.currency === amount.currency && Math.abs(Date.parse(c.date)-Date.parse(target.date)) <= 48*3600000)) continue;
    if (allOperations().some(o=>o.chatJid===target.chat && o.waMessageId===target.messageId)) continue;
    let op = allOperations().find(o=>o.chatJid===origin.chat && o.waMessageId===origin.messageId);
    if (!op && !wasProcessed(origin)) {
      const p=ingestMessage({text:origin.text,chat:origin.chat,messageId:origin.messageId,messageDate:origin.date,chatName:origin.chatName,fromName:origin.fromName,fromMe:origin.fromMe,senderPhone:origin.senderPhone,pairedOrigin:true});
      op=p.op;
      if (op && p.line) { saveSeen(origin,'posted'); added++; }
    }
    if (!op || op.status!=='posted' || op.dir !== 'in') continue;
    const dir=senderDirection(target.senderPhone)!;
    if (linkGroupMirror({opId:op.id,originChat:origin.chat,targetChat:target.chat,targetName:target.chatName,targetDate:target.date,targetMessageId:target.messageId,targetDir:dir})) {
      saveSeen(target,'linked');
    }
  }
  for (const c of batch) {
    if (wasProcessed(c)) { skipped++; continue; }
    const p = parse(c); if (!p) { skipped++; continue; }
    if (c.chat.endsWith('@g.us') && !senderDirection(c.senderPhone)) { flag(c, 'رقم المرسل غير مؤكد؛ يلزم التحقق يدوياً'); saveSeen(c, 'unknown-sender'); review++; continue; }
    const similar = c.chat.endsWith('@g.us') && batch.some(other => { const q = parse(other); return other !== c && other.chat.endsWith('@g.us') && other.chat !== c.chat && q && q.amount === p.amount && q.currency === p.currency && Math.abs(Date.parse(other.date)-Date.parse(c.date)) <= 48*3600000; });
    const result = ingestMessage({ text:c.text, chat:c.chat, messageId:c.messageId, messageDate:c.date, chatName:c.chatName, fromName:c.fromName, fromMe:c.fromMe, senderPhone:c.senderPhone, forceReview:Boolean(similar) });
    if (result.op) { if (result.line) { added++; saveSeen(c,'posted'); } else { review++; flag(c, result.reason || 'حركة مشابهة بمجموعة أخرى؛ راجع سجل العمليات'); saveSeen(c,'review'); } }
    else { skipped++; flag(c, result.reason || 'تعذرت المعالجة'); saveSeen(c,'skipped'); }
  }
  return { date:onlyDate || '48h', available:batch.length, added, review, skipped };
}
export function scheduleHistory(owner: string, delay = 30000) {
  if (!owner) return; g.__nasrHistoryOwner = owner;
  if (g.__nasrHistoryTimer) return;
  g.__nasrHistoryTimer = setTimeout(() => { g.__nasrHistoryTimer = undefined; try { const r=processHistory(owner); console.log(`[history-48h] مرحل ${r.added}، للمراجعة ${r.review}، متخطى ${r.skipped}`); } catch (e) { console.error('[history-48h]',e); } }, delay);
  g.__nasrHistoryTimer.unref?.();
}
export function history48Status(owner: string | null) {
  return { available: items.filter(c=>c.owner===owner && within48(c.date) && Boolean(parse(c))).length, pending: items.filter(c=>c.owner===owner && within48(c.date) && allowed(c) && Boolean(parse(c)) && !wasProcessed(c)).length, issues:(g.__nasrHistoryIssues ?? issues).filter(i=>i.owner===owner).slice(0,100), note:'فقط ما زامنه واتساب فعلياً؛ قد يكون السجل غير مكتمل.' };
}
export function historyStatus(owner: string | null) {
  const target = shiftDate(todayInTz(),-1), candidates = items.filter(c=>owner && c.owner===owner && within48(c.date) && dateInTz(c.date)===target && allowed(c) && Boolean(parse(c))); 
  return { date:target, available:candidates.length, pending:candidates.filter(c=>!wasProcessed(c)).length, note:'فقط الرسائل التي زامنها واتساب؛ وقد تكون غير مكتملة.' };
}
export function postYesterday(owner:string) { return processHistory(owner,shiftDate(todayInTz(),-1)); }
export function clearHistory() { items=[]; save(); if (g.__nasrHistoryTimer) clearTimeout(g.__nasrHistoryTimer); g.__nasrHistoryTimer=undefined; }
