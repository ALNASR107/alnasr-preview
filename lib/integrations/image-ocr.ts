/** OCR محلي حصراً. صور واتساب تُحمّل مؤقتاً ثم تُحذف، والنتائج تحتاج مراجعة. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readJson, writeJson } from '@/lib/store';
import { allOperations, createOperation } from '@/lib/mock';
import { parseOperationText, parseLana, postingBlockReason } from './wa-inbox';
import { makeFx, groupPostingAmount } from './group-fx';
import { groupCurrencyMode } from './group-rules';
import { senderDirection } from './sender-direction';
import { matchedWalletReceipt, matchedTransferReceipt } from './receipt-ocr';
import { readImageOcr, tesseractExecutable } from './image-reader';
import { postToSheet } from '@/lib/sheet';
const exec = promisify(execFile);
export type OcrResult = { at: string; chat: string; chatName: string; messageId: string; text: string; status: 'posted' | 'review' | 'unclear' | 'error'; opId?: string; reason?: string };
const g = globalThis as unknown as { __nasrOcr?: OcrResult[]; __nasrOcrActive?: Set<string> };
let results = (g.__nasrOcr ??= readJson<OcrResult[]>('wa-image-ocr', []));
const active = (g.__nasrOcrActive ??= new Set());
function save() { g.__nasrOcr = results; writeJson('wa-image-ocr', results.slice(0, 500)); }
export function ocrResults() { return results.slice(0, 100); }
export async function ocrStatus() {
  try { const { stdout } = await exec(tesseractExecutable(), ['--list-langs'], { timeout: 5000, maxBuffer: 100000 });
    const langs = stdout.split(/\s+/); return { ready: langs.includes('ara') && langs.includes('eng'), langs: langs.filter(x => x === 'ara' || x === 'eng') };
  } catch { return { ready: false, langs: [] }; }
}
export async function processImage(m: any, chatName: string, senderPhone?: string) {
  const chat = String(m?.key?.remoteJid || ''), messageId = String(m?.key?.id || ''), id = `${chat}|${messageId}`;
  if (!chat || !messageId || active.has(id) || results.some(r => r.chat === chat && r.messageId === messageId) || allOperations().some(o => o.chatJid === chat && o.waMessageId === messageId)) return;
  active.add(id);
  const row: OcrResult = { at: new Date().toISOString(), chat, chatName, messageId, text: '', status: 'error' };
  let dir = '';
  try {
    const status = await ocrStatus();
    if (!status.ready) throw new Error('محرك OCR أو ملفات العربية والإنجليزية غير مثبتة على هذا الجهاز');
    const size = Number(m.message?.imageMessage?.fileLength || 0);
    if (size > 5 * 1024 * 1024) throw new Error('الصورة أكبر من 5 ميغابايت');
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const stream = await downloadMediaMessage(m, 'stream', {});
    const chunks: Buffer[] = []; let total = 0;
    const timeout = setTimeout(() => stream.destroy(new Error('انتهت مهلة تنزيل الصورة')), 20000);
    try {
      for await (const chunk of stream) { const buf = Buffer.from(chunk); total += buf.length; if (total > 5 * 1024 * 1024) { stream.destroy(); throw new Error('الصورة أكبر من 5 ميغابايت'); } chunks.push(buf); }
    } finally { clearTimeout(timeout); }
    dir = await mkdtemp(path.join(tmpdir(), 'nasr-ocr-'));
    const file = path.join(dir, 'image'); await writeFile(file, Buffer.concat(chunks), { mode: 0o600 });
    const reading = await readImageOcr(file);
    row.text = reading.text.slice(0, 4000);
    // الترحيل يبقى مشروطاً بقراءتين أصليتين، لا التحسين الذي قد يغيّر أرقاماً.
    const wallet = matchedWalletReceipt(reading.original, reading.second);
    const transfer = matchedTransferReceipt(reading.original, reading.second);
    const receipt = wallet || transfer;
    const receiptDir = senderDirection(senderPhone);
    if (receipt && receiptDir) {
      // لا نكرر إيصالاً سبق تسجيل مرجعه أو حركة واتساب لها نفس معرّف الرسالة.
      const existing = allOperations().find(o => o.source === 'whatsapp' && (o.chatJid === chat && o.waMessageId === messageId || (wallet && o.waText?.includes(`الرقم المرجعي ${wallet.reference}`))));
      if (existing) { row.status = 'unclear'; row.reason = 'الإيصال أو الرقم المرجعي مسجّل مسبقاً؛ تحقق من سجل العمليات'; return; }
      const sec = Number(m?.messageTimestamp);
      const messageDate = Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000).toISOString() : undefined;
      const similar = allOperations().some(o => o.source === 'whatsapp' && o.chatJid?.endsWith('@g.us') && o.chatJid !== chat && o.amount === receipt.amount && o.currency === receipt.currency && Math.abs(Date.parse(o.date) - Date.parse(messageDate || new Date().toISOString())) <= 48 * 3600000);
      const rateMissing = !groupPostingAmount(chat, receipt.currency, receipt.amount, messageDate || '', groupCurrencyMode(chat));
      const op = createOperation({ date: messageDate, fx: messageDate ? makeFx(chat, receipt.currency, receipt.amount, messageDate) : undefined, amount: receipt.amount, currency: receipt.currency, customer: receipt.phone, note: wallet ? `إيصال محفظة ناجح — الرقم المرجعي ${wallet.reference}` : 'إشعار تحويل ناجح من صورة', type: wallet ? 'إيداع' : 'تحويل', method: 'محفظة', dir: receiptDir, waSenderPhone: senderPhone, status: similar || rateMissing ? 'review' : 'posted', account: 'الصندوق الرئيسي', source: 'whatsapp', waText: `المبلغ الأصلي ${receipt.amount} ${receipt.currency} — الهاتف ${receipt.phone}\n${wallet ? `الرقم المرجعي ${wallet.reference}\n` : ''}${row.text}`, waFrom: chat, waMessageId: messageId, chatJid: chat, chatName });
      row.opId = op.id;
      if (similar || rateMissing) { row.status = 'review'; row.reason = rateMissing ? 'لا يوجد سعر قص سابق واضح لنفس المجموعة والعملة' : 'حركة مشابهة بمجموعة أخرى؛ للمراجعة'; }
      else { const result = postToSheet([op.id]); row.status = result.added ? 'posted' : 'review'; if (!result.added) row.reason = 'تعذّر ترحيل السطر؛ تحقق من سجل العمليات'; }
      return;
    }
    // لا نخمّن بنوداً أو مبالغ متعددة: نقبل صيغة مالية واحدة فقط للمراجعة البشرية.
    const lana = parseLana(row.text);
    const parsed = lana || parseOperationText(row.text.replace(/\s+/g, ' '));
    const groupDir = senderDirection(senderPhone);
    const blocked = postingBlockReason(row.text);
    if (blocked || !parsed || !groupDir) { row.status = 'unclear'; row.reason = !groupDir ? 'هوية المرسل غير مؤكدة؛ لا ترحيل' : 'القراءة غير واضحة أو لم تتفق القراءتان على الإيصال؛ راجع الصورة والنص قبل الترحيل'; }
    else {
      const sec = Number(m?.messageTimestamp);
      const messageDate = Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000).toISOString() : undefined;
      const op = createOperation({ date: messageDate, fx: messageDate ? makeFx(chat, parsed.currency, parsed.amount, messageDate) : undefined, amount: parsed.amount, currency: parsed.currency, customer: parsed.customer, note: 'قراءة صورة — يرجى مراجعة المبلغ والعملة والاتجاه', type: parsed.type, method: parsed.method, dir: lana ? 'out' : groupDir, waSenderPhone: senderPhone, status: 'review', account: 'الصندوق الرئيسي', source: 'whatsapp', waText: row.text.slice(0,500), waFrom: chat, waMessageId: messageId, chatJid: chat, chatName });
      row.status = 'review'; row.opId = op.id;
    }
  } catch (err) { row.reason = (err as Error).message || 'فشل قراءة الصورة'; }
  finally { if (dir) await rm(dir, { recursive: true, force: true }); results = [row, ...results].slice(0, 500); save(); active.delete(id); }
}
