/** سجل عرض منفصل عن الترحيل؛ الصور العادية تُحفظ محلياً بحدود مساحة واضحة. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, readJson, writeJson } from '@/lib/store';

type Entry = { at: string; chat: string; chatName: string; fromName: string; fromMe: boolean; messageId: string; text: string; mediaType?: string; mediaId?: string; mediaReason?: string; mediaMime?: string; fileName?: string };
const globalState = globalThis as unknown as { __nasrDisplay?: Entry[]; __nasrDisplayPending?: Set<string> };
let entries = (globalState.__nasrDisplay ??= readJson<Entry[]>('wa-display', []));
const pending = (globalState.__nasrDisplayPending ??= new Set<string>());
const directory = path.join(DATA_DIR, 'wa-images');
const MAX_IMAGE = 5 * 1024 * 1024, MAX_TOTAL = 200 * 1024 * 1024;
function save() { globalState.__nasrDisplay = entries; writeJson('wa-display', entries); }
export function displayEntries() { return (globalState.__nasrDisplay ?? entries); }
function update(chat: string, id: string, patch: Partial<Entry>) {
  entries = entries.map(x => x.chat === chat && x.messageId === id ? { ...x, ...patch } : x); save();
}
type ReactionEvent = { chat: string; targetId: string; eventId: string; actor: string; fromName: string; text: string; at: number };
const reactionState = globalThis as unknown as { __nasrReactions?: ReactionEvent[] };
function reactions() { return (reactionState.__nasrReactions ??= readJson<ReactionEvent[]>('wa-reactions', [])); }
/** Store the original target and sender, including removals, rather than inferring from nearby messages. */
export function archiveReaction(m: any) {
  const r = m?.message?.reactionMessage;
  const chat = String(m?.key?.remoteJid || ''), targetId = String(r?.key?.id || ''), eventId = String(m?.key?.id || '');
  if (!r || !chat || !targetId || !eventId || (r.key.remoteJid && r.key.remoteJid !== chat)) return;
  const actor = m.key.fromMe ? 'self' : String(m.key.participantAlt || m.key.participant || m.participant || (!chat.endsWith('@g.us') ? chat : `unknown:${eventId}`));
  const at = Number(r.senderTimestampMs) || Number(m.messageTimestamp) * 1000 || Date.now();
  const all = reactions();
  if (all.some(x => x.chat === chat && x.eventId === eventId)) return;
  const next = [{ chat, targetId, eventId, actor, fromName: m.key.fromMe ? 'أنت' : String(m.pushName || ''), text: String(r.text || '').slice(0,32), at }, ...all].slice(0,10000);
  reactionState.__nasrReactions = next; writeJson('wa-reactions', next);
}
export function knownReactionEvents() { return new Set(reactions().map(r => JSON.stringify([r.chat,r.eventId]))); }
export function displayReactions() {
  const latest = new Map<string, ReactionEvent>();
  for (const r of reactions()) {
    const key = JSON.stringify([r.chat,r.targetId,r.actor]); const old = latest.get(key);
    if (!old || r.at > old.at) latest.set(key,r);
  }
  return Array.from(latest.values()).filter(r => r.text).map(({ chat, targetId, text, fromName }) => ({ chat, targetId, text, fromName }));
}
export function displayImage(id: string): { file: string; mime: string } | undefined {
  if (!/^[a-f0-9]{64}$/.test(id)) return;
  if (!displayEntries().some(e => e.mediaId === id)) return;
  for (const [ext, mime] of [['jpg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp'], ['pdf','application/pdf'], ['xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ['txt','text/plain; charset=utf-8'], ['ogg','audio/ogg'], ['wav','audio/wav'], ['mp3','audio/mpeg'], ['mp4','video/mp4'], ['webm','video/webm']]) {
    const file = path.join(directory, `${id}.${ext}`); if (fs.existsSync(file)) return { file, mime };
  }
}
function normalized(raw: any) {
  let v = raw;
  for (let i = 0; i < 4; i++) {
    // صور العرض لمرة واحدة لا تُحفظ أو تُعرض مجدداً.
    if (v?.viewOnceMessage || v?.viewOnceMessageV2 || v?.viewOnceMessageV2Extension || v?.ephemeralMessage) return null;
    const next = v?.documentWithCaptionMessage?.message || v?.editedMessage?.message;
    if (!next) break; v = next;
  }
  return v;
}
export async function archiveDisplayMessage(m: any, chatName: string) {
  const chat = String(m?.key?.remoteJid || ''), messageId = String(m?.key?.id || '');
  if (!chat || !messageId || chat.includes('broadcast') || chat.endsWith('@newsletter')) return;
  const content = normalized(m.message);
  if (!content) return;
  if (content.reactionMessage) { archiveReaction({ ...m, message: content }); return; }
  if (entries.some(e => e.chat === chat && e.messageId === messageId) || pending.has(`${chat}|${messageId}`)) return;
  const mediaType = content.imageMessage ? 'image' : content.videoMessage ? 'video' : content.documentMessage ? 'document' : content.audioMessage ? 'audio' : content.stickerMessage ? 'sticker' : undefined;
  const special = content.locationMessage ? `[موقع] ${content.locationMessage.name || ''} ${content.locationMessage.degreesLatitude ?? ''}, ${content.locationMessage.degreesLongitude ?? ''}`.trim() : content.contactMessage ? `[جهة اتصال] ${content.contactMessage.displayName || ''}\n${content.contactMessage.vcard || ''}`.trim() : content.reactionMessage ? `[تفاعل] ${content.reactionMessage.text || ''}` : content.pollCreationMessage ? `[استطلاع] ${content.pollCreationMessage.name || ''}` : '';
  const text = String(content.conversation ?? content.extendedTextMessage?.text ?? content.imageMessage?.caption ?? content.videoMessage?.caption ?? content.documentMessage?.caption ?? special);
  // تجاهل رسائل البروتوكول التي ليست محتوى محادثة، ولا نفترض نوعها.
  if (!text && !mediaType) return;
  const sec = Number(m.messageTimestamp), at = Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000).toISOString() : new Date().toISOString();
  const item: Entry = { at, chat, chatName, fromName: String(m.pushName || ''), fromMe: Boolean(m.key.fromMe), messageId, text: text.slice(0, 10000), mediaType, fileName: content.documentMessage?.fileName ? String(content.documentMessage.fileName).slice(0, 150) : undefined };
  entries = [item, ...entries]; save();
  if (!mediaType) return;
  const key = `${chat}|${messageId}`; pending.add(key);
  try {
    if (pending.size > 4) throw new Error('عدد المرفقات قيد التنزيل كبير');
    const part = content.imageMessage || content.videoMessage || content.documentMessage || content.audioMessage || content.stickerMessage;
    const size = Number(part?.fileLength || 0);
    if (size > MAX_IMAGE) throw new Error('المرفق أكبر من 5 ميغابايت');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const files = fs.readdirSync(directory).filter(f => /^[a-f0-9]{64}\.(jpg|png|webp|pdf|xlsx|txt|ogg|wav|mp3|mp4|webm)$/.test(f));
    const total = files.reduce((n, f) => { try { return n + fs.statSync(path.join(directory, f)).size; } catch { return n; } }, 0);
    if (total + Math.max(size, MAX_IMAGE) > MAX_TOTAL) throw new Error('امتلأت مساحة المرفقات المحلية (200 ميغابايت)');
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const stream = await downloadMediaMessage(m, 'stream', {});
    const chunks: Buffer[] = []; let count = 0;
    const timer = setTimeout(() => stream.destroy(new Error('انتهت مهلة تنزيل الصورة')), 20000);
    try { for await (const c of stream) { const b = Buffer.from(c); count += b.length; if (count > MAX_IMAGE) { stream.destroy(); throw new Error('المرفق أكبر من 5 ميغابايت'); } chunks.push(b); } }
    finally { clearTimeout(timer); }
    const buffer = Buffer.concat(chunks);
    let ext = '';
    if (buffer.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) ext='jpg';
    else if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext='png';
    else if (buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP') ext='webp';
    else if (buffer.subarray(0,5).toString() === '%PDF-') ext='pdf';
    else if (buffer.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04])) && /\.xlsx$/i.test(item.fileName || '')) ext='xlsx';
    else if (buffer.subarray(0,4).toString() === 'OggS') ext='ogg';
    else if (buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WAVE') ext='wav';
    else if (buffer.subarray(0,3).toString() === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) ext='mp3';
    else if (buffer.subarray(4,8).toString() === 'ftyp') ext='mp4';
    else if (buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))) ext='webm';
    else if (mediaType === 'document' && /\.txt$/i.test(item.fileName || '') && !buffer.includes(0)) ext='txt';
    if (!ext) throw new Error('نوع المرفق غير مدعوم للعرض أو التحليل');
    const id = crypto.createHash('sha256').update(chat).update('\0').update(messageId).digest('hex');
    fs.writeFileSync(path.join(directory, `${id}.${ext}`), buffer, { mode: 0o600 });
    update(chat, messageId, { mediaId: id, mediaMime: ext });
  } catch (err) { update(chat, messageId, { mediaReason: (err as Error).message || 'تعذّر تنزيل الصورة' }); }
  finally { pending.delete(key); }
}
