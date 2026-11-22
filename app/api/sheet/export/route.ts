import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { expandDouble, listLines, totalsOf } from '@/lib/sheet';
import { getSheet } from '@/lib/sheets';
import { withGroupAccount } from '@/lib/integrations/sheet-group-account';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** أعمدة الشيت — بنفس ترتيب ملفك (الورقة RTL: A تظهر على اليمين) */
const COLUMNS = [
  { header: 'الحساب', key: 'account', width: 26, align: 'right' as const },
  { header: 'البيان', key: 'statement', width: 46, align: 'right' as const },
  { header: 'مدين', key: 'debit', width: 15, align: 'center' as const, tone: 'debit' },
  { header: 'دائن', key: 'credit', width: 15, align: 'center' as const, tone: 'credit' },
  { header: 'العملة', key: 'currency', width: 9, align: 'center' as const },
  { header: 'التعادل', key: 'fxUsd', width: 19, align: 'center' as const },
  { header: 'المكافئ', key: 'fxRate', width: 15, align: 'center' as const },
  { header: 'مركز التكلفة', key: 'costCenter', width: 17, align: 'center' as const },
  { header: 'التاريخ', key: 'date', width: 13, align: 'center' as const },
  { header: 'المبلغ', key: 'amount', width: 15, align: 'center' as const },
  { header: 'الحساب المقابل', key: 'counterAccount', width: 24, align: 'right' as const },
];

const HEADER_FILL = 'FFDDE7F5';
const DEBIT_FILL = 'FFF8D7DA';
const CREDIT_FILL = 'FFDFF0E1';
const DEBIT_TEXT = 'FFB03A4B';
const CREDIT_TEXT = 'FF1E7A5F';
const INK = 'FF0D1B2A';
const BRAND = 'FF224C9C';
const NUM_FMT = '#,##0.##';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') === 'double' ? 'double' : 'single';
  // شيت محدّد أو كل الشيتات
  const sheetParam = req.nextUrl.searchParams.get('sheet') ?? 'all';
  const sheet = sheetParam === 'all' ? undefined : getSheet(sheetParam);
  if (sheetParam !== 'all' && !sheet) return NextResponse.json({ error: 'الشيت غير موجود' }, { status: 404 });
  const base = listLines(sheet?.id).map(withGroupAccount);
  const lines = mode === 'double' ? expandDouble(base) : base;
  const totals = totalsOf(lines);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'شركة النصر';
  wb.created = new Date();

  const ws = wb.addWorksheet((sheet?.name ?? 'شيت الترحيل').slice(0, 28), {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  const last = COLUMNS.length; // 11

  /* ---------- العنوان ---------- */
  ws.mergeCells(1, 1, 1, last);
  const title = ws.getCell(1, 1);
  title.value = sheet
    ? `شيت الترحيل — ${sheet.name} · شركة النصر للخدمات المالية والإدارية`
    : 'شيت ترحيل الحركات — كل الشيتات · شركة النصر للخدمات المالية والإدارية';
  title.font = { bold: true, size: 14, color: { argb: BRAND } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, last);
  const stamp = ws.getCell(2, 1);
  const today = new Date().toISOString().slice(0, 10);
  stamp.value = `تاريخ التصدير: ${today}   ·   عدد السطور: ${totals.count}   ·   العملة: ${lines[0]?.currency ?? 'ل.س'}   ·   ${mode === 'double' ? 'قيد مزدوج' : 'سطر واحد + حساب مقابل'}`;
  stamp.font = { size: 10, color: { argb: 'FF6E7D93' } };
  stamp.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  ws.getRow(3).height = 6;

  /* ---------- رأس الجدول ---------- */
  const headRow = ws.getRow(4);
  headRow.height = 30;
  COLUMNS.forEach((col, i) => {
    const cell = headRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = {
      bold: true,
      size: 11,
      color: { argb: col.tone === 'debit' ? DEBIT_TEXT : col.tone === 'credit' ? CREDIT_TEXT : INK },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: col.tone === 'debit' ? DEBIT_FILL : col.tone === 'credit' ? CREDIT_FILL : HEADER_FILL },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFC7D3EC' } },
      left: { style: 'thin', color: { argb: 'FFC7D3EC' } },
      bottom: { style: 'thin', color: { argb: 'FFC7D3EC' } },
      right: { style: 'thin', color: { argb: 'FFC7D3EC' } },
    };
  });

  /* ---------- السطور ---------- */
  const dataRows = lines.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  dataRows.forEach((line) => {
    const row = ws.addRow({
      account: line.account,
      statement: line.statement,
      debit: line.debit || null,
      credit: line.credit || null,
      currency: line.currency,
      balance: line.balance,
      reward: line.reward || null,
      costCenter: line.costCenter,
      date: line.date,
      amount: line.amount,
      counterAccount: line.counterAccount,
      fxRate: line.fx?.rate ?? null,
      fxUsd: line.fx?.usd ?? null,
    });

    row.height = 20;
    COLUMNS.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      cell.alignment = { horizontal: col.align, vertical: 'middle', wrapText: col.key === 'statement' };
      cell.font = { size: 10.5, color: { argb: INK } };
      cell.border = {
        top: { style: 'hair', color: { argb: 'FFD9E1F2' } },
        left: { style: 'hair', color: { argb: 'FFD9E1F2' } },
        bottom: { style: 'hair', color: { argb: 'FFD9E1F2' } },
        right: { style: 'hair', color: { argb: 'FFD9E1F2' } },
      };
      if (['debit', 'credit', 'balance', 'reward', 'amount'].includes(col.key)) {
        cell.numFmt = NUM_FMT;
        cell.font = { size: 10.5, bold: ['debit', 'credit', 'amount'].includes(col.key), color: { argb: INK } };
      }
      if (col.key === 'debit' && line.debit) cell.font = { size: 10.5, bold: true, color: { argb: DEBIT_TEXT } };
      if (col.key === 'credit' && line.credit) cell.font = { size: 10.5, bold: true, color: { argb: CREDIT_TEXT } };
      if (col.key === 'fxRate') cell.numFmt = '#,##0.######';
      if (col.key === 'fxUsd') cell.numFmt = '#,##0.00';
      if (col.key === 'currency') cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  /* ---------- الإجماليات ---------- */
  const multi = Boolean(totals.multiCurrency);
  const totalRow = ws.addRow({
    account: 'الإجمالي',
    statement: `${totals.count} حركة`,
    // في العملات المختلطة لا نجمع مبالغ مختلفة العملة — التفصيل في السطور التالية
    debit: multi ? null : totals.debit,
    credit: multi ? null : totals.credit,
    amount: multi ? null : totals.debit + totals.credit,
  });
  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 11, color: { argb: INK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5FB' } };
    cell.alignment = { horizontal: colNumber <= 2 ? 'right' : 'center', vertical: 'middle' };
    cell.border = { top: { style: 'double', color: { argb: 'FFA0B5DE' } } };
    if (colNumber === 3) cell.numFmt = NUM_FMT;
    if (colNumber === 4) cell.numFmt = NUM_FMT;
    if (colNumber === 10) cell.numFmt = NUM_FMT;
  });
  // دمج خليتي «الإجمالي» و«العدد»
  ws.mergeCells(totalRow.number, 1, totalRow.number, 2);
  totalRow.getCell(1).value = totals.multiCurrency
    ? `الإجمالي — ${totals.count} حركة (عملات مختلطة: انظر تفصيل كل عملة أدناه)`
    : `الإجمالي — ${totals.count} حركة`;
  totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

  /* ---------- إجماليات لكل عملة ---------- */
  if ((totals.byCurrency ?? []).length > 1) {
    for (const c of totals.byCurrency) {
      const r = ws.addRow({
        account: `إجمالي ${c.currency}`,
        statement: `${c.count} حركة بعملة ${c.currency}`,
        debit: c.debit,
        credit: c.credit,
        amount: c.debit + c.credit,
      });
      r.height = 20;
      r.eachCell((cell, col) => {
        cell.font = { bold: true, size: 10.5, color: { argb: BRAND } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF3FC' } };
        cell.alignment = { horizontal: col <= 2 ? 'right' : 'center', vertical: 'middle' };
        if ([3, 4, 10].includes(col)) cell.numFmt = NUM_FMT;
      });
      ws.mergeCells(r.number, 1, r.number, 2);
    }
  }

  /* ---------- سطر التوازن ---------- */
  const okMsg =
    mode === 'double'
      ? totals.balanced
        ? 'الشيت متوازن — مجموع المدين = مجموع الدائن ✔'
        : 'فرق في التوازن ✖'
      : totals.rowsValid
      ? 'كل سطر له طرف واحد (مدين أو دائن) مع حساب مقابل ✔'
      : 'سطور تحتاج مراجعة (طرفان أو حساب مقابل ناقص) ✖';
  const okColor = mode === 'double' ? totals.balanced : totals.rowsValid;

  const checkRow = ws.addRow({ account: okMsg });
  ws.mergeCells(checkRow.number, 1, checkRow.number, last);
  const chk = checkRow.getCell(1);
  chk.font = { bold: true, size: 10.5, color: { argb: okColor ? CREDIT_TEXT : DEBIT_TEXT } };
  chk.alignment = { horizontal: 'center', vertical: 'middle' };
  chk.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: okColor ? CREDIT_FILL : DEBIT_FILL } };
  checkRow.height = 22;

  /* ---------- تجميد + فلترة + طباعة ---------- */
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: last } };
  ws.pageSetup.printTitlesRow = '4:4';
  ws.headerFooter.oddFooter = '&Rصفحة &P من &N&Lشركة النصر';

  const buf = await wb.xlsx.writeBuffer();
  // أسماء الملفات: نسخة ASCII + نسخة UTF-8 (العربية لا تصلح في ترويسة ByteString)
  const asciiSlug = (sheet?.id ?? 'all').replace(/[^\w.-]+/g, '-').slice(0, 40);
  const asciiName = `nasr-sheet-${asciiSlug}-${today}-${mode}.xlsx`;
  const prettyName = `شيت-${(sheet?.name ?? 'كل-الشيتات').replace(/[\\/:*?"<>|\s]+/g, '-')}-${today}-${mode}.xlsx`;
  const disposition = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(prettyName)}`;

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': disposition,
      'Cache-Control': 'no-store',
    },
  });
}
