import type { SheetLine } from '@/lib/sheet-shared';
import { getSheet } from '@/lib/sheets';
import { getOperation } from '@/lib/mock';
import { waGroupName } from '@/lib/integrations/wa-web';

/** اسم مجموعة مصدر حركة واتساب للعرض والتصدير فقط، دون تغيير الحساب المحفوظ. */
export function withGroupAccount(line: SheetLine): SheetLine {
  if (line.source !== 'whatsapp') return line;
  const sheet = line.sheetId ? getSheet(line.sheetId) : undefined;
  const op = getOperation(line.opId);
  const jid = sheet?.kind === 'group' ? sheet.jid : op?.chatJid?.endsWith('@g.us') ? op.chatJid : undefined;
  if (!jid) return line;
  const fallback = `مجموعة ${jid.split('@')[0]}`;
  const actual = waGroupName(jid);
  const sheetName = sheet?.kind === 'group' && sheet.jid === jid ? sheet.name?.trim() : '';
  const opName = op?.chatJid === jid ? op.chatName?.trim() : undefined;
  const name = actual || (sheetName && sheetName !== fallback ? sheetName : '') || (opName && opName !== fallback ? opName : '') || fallback;
  return { ...line, account: name };
}
