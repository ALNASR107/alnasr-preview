/** يقرأ فقط إيصال محفظة ناجح ومكتمل؛ لا يستخرج المبلغ من أرقام الهاتف أو المرجع. */
export type WalletReceipt = { amount: number; currency: 'EGP'; phone: string; reference: string };
export function parseWalletReceipt(raw: string): WalletReceipt | undefined {
  const t = (raw || '').replace(/[\u200e\u200f\u061c]/g, '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/ـ/g, '');
  if (!/(?:ا|إ|آ)يداع\s+(?:في|فى)\s+المحفظ[ةه]/u.test(t) || !/(?:حالة\s+العملية\s+ناجحة|العملية\s+ناجحة)/u.test(t) || !/الرقم\s+المرجعي/u.test(t) || !/رقم\s+العميل/u.test(t)) return;
  const phoneMatch = t.match(/(?:رقم\s+العميل[^\d\n]{0,12}(0\d{9,14})|(0\d{9,14})[^\d\n]{0,12}رقم\s+العميل)/u);
  const refMatch = t.match(/(?:الرقم\s+المرجعي[^\d\n]{0,12}(\d{12,24})|(\d{12,24})[^\d\n]{0,12}الرقم\s+المرجعي)/u);
  if (!phoneMatch || !refMatch) return;
  const totalRows = t.split(/\r?\n/).filter(line => /إجمالي|اجمالي|إجمالى|اجمالى/u.test(line));
  if (totalRows.length !== 1) return;
  const row = totalRows[0];
  if (!/(?:ج\s*[.٫]\s*م|جنيه(?: مصري)?|EGP)/iu.test(row)) return;
  const nums = [...row.matchAll(/(?<![\d.,])\d+(?:,\d{3})*(?![\d.,])/g)];
  if (nums.length !== 1) return;
  const amount = Number(nums[0][0].replace(/,/g, ''));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000) return;
  return { amount, currency:'EGP', phone:phoneMatch[1] || phoneMatch[2], reference:refMatch[1] || refMatch[2] };
}
export function matchedWalletReceipt(a:string,b:string): WalletReceipt | undefined {
  const x=parseWalletReceipt(a),y=parseWalletReceipt(b);
  return x && y && x.amount===y.amount && x.phone===y.phone && x.reference===y.reference ? x : undefined;
}

/** إشعار تحويل ناجح يحتوي مبلغاً واحداً ورقم هاتف واضحاً. */
export type TransferReceipt = { amount: number; currency:'EGP'; phone:string };
export function parseTransferReceipt(raw:string): TransferReceipt | undefined {
  const t = (raw || '').replace(/[\u200e\u200f\u061c]/g, '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/ـ/g,'');
  if (!/تم\s+تحويل/u.test(t) || !/بنجاح/u.test(t) || /(?:لم\s+يتم|فشل|فشلت|غير\s+ناجح|[؟?])/u.test(t)) return;
  const amounts = [...t.matchAll(/(?<![\d.,])(?<value>\d+(?:,\d{3})*)\s*(?:جنيه(?:ات|ا|اً| مصري)?|EGP)(?![\p{L}\p{N}])/giu)];
  if (amounts.length !== 1) return;
  const phones = [...t.matchAll(/(?<!\d)01[0125]\d{8}(?!\d)/g)];
  if (phones.length !== 1) return;
  const amount = Number(amounts[0].groups!.value.replace(/,/g,''));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000) return;
  const rest = t.replace(amounts[0][0], ' ').replace(phones[0][0], ' ');
  if (/\d/u.test(rest)) return; // رسوم أو مبالغ أخرى: لا نخمّن.
  return {amount,currency:'EGP',phone:phones[0][0]};
}
export function matchedTransferReceipt(a:string,b:string): TransferReceipt | undefined {
  const x=parseTransferReceipt(a),y=parseTransferReceipt(b);
  return x && y && x.amount===y.amount && x.phone===y.phone ? x : undefined;
}
