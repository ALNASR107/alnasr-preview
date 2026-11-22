/** اتجاه حركات المجموعات حسب رقم المرسل المحدد من صاحب الحساب. */
const CREDIT_PHONE = '905550639755';
export function normalizeParticipantPhone(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.endsWith('@s.whatsapp.net')) return undefined;
  const n = value.split('@')[0].split(':')[0];
  return /^\d{8,15}$/.test(n) ? n : undefined;
}
export function senderDirection(phone: string | undefined): 'in' | 'out' | undefined {
  if (!phone || !/^\d{8,15}$/.test(phone)) return undefined;
  return phone === CREDIT_PHONE ? 'out' : 'in';
}
export async function groupSenderPhone(m: any, sock: any): Promise<string | undefined> {
  if (m?.key?.fromMe) return normalizeParticipantPhone(String(sock.user?.id || '').replace(/:\d+@/, '@'));
  const parts = [m?.key?.participantAlt, m?.key?.participant, m?.participant];
  const found = [...new Set(parts.map(normalizeParticipantPhone).filter(Boolean))] as string[];
  if (found.length === 1) return found[0];
  if (found.length > 1) return undefined;
  const lid = parts.find(v => typeof v === 'string' && v.endsWith('@lid'));
  if (!lid) return undefined;
  try { return normalizeParticipantPhone(await sock.signalRepository?.lidMapping?.getPNForLID(lid)); }
  catch { return undefined; }
}
export function historySenderPhone(m: any, owner: string) {
  if (m?.key?.fromMe) return /^\d{8,15}$/.test(owner) ? owner : undefined;
  const found = [...new Set([m?.key?.participantAlt, m?.key?.participant, m?.participant].map(normalizeParticipantPhone).filter(Boolean))] as string[];
  return found.length === 1 ? found[0] : undefined;
}
