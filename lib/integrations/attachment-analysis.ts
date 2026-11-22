/** تحليل محلي محدود وآمن نسبياً للمرفقات، بلا إنشاء عمليات أو إرسال رسائل. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { displayImage } from './wa-display';
import { readImageOcr, tesseractExecutable } from './image-reader';
import { parseOperationText, parseConfirmedVodafone } from './wa-inbox';
const exec = promisify(execFile);
export async function analyseAttachment(id: string) {
  const file = displayImage(id);
  if (!file) throw new Error('المرفق غير متاح');
  let text = '', limited = false;
  if (file.mime.startsWith('image/')) {
    const out = await readImageOcr(file.file, false); text = out.text;
  } else if (file.mime === 'application/pdf') {
    const info = await exec('pdfinfo', [file.file], { timeout: 8000, maxBuffer: 100000 });
    const pages = Number(info.stdout.match(/^Pages:\s*(\d+)/m)?.[1] || 0);
    if (!pages || pages > 30) throw new Error('يتطلب PDF صالحاً لا يتجاوز 30 صفحة');
    const output = await exec('pdftotext', ['-f','1','-l','10','-layout', file.file, '-'], { timeout: 20000, maxBuffer: 1024 * 1024 }); text = output.stdout; limited = pages > 10;
    if (!text.trim()) {
      const dir = await mkdtemp(path.join(tmpdir(), 'nasr-pdf-'));
      try {
        await exec('pdftoppm', ['-f','1','-l',String(Math.min(pages,3)),'-scale-to','1800','-png', file.file, path.join(dir, 'page')], { timeout: 30000, maxBuffer: 100000 });
        for (let i=1;i<=Math.min(pages,3);i++) { const n=String(i).padStart(String(pages).length,'0'); const x=await exec(tesseractExecutable(),[path.join(dir,`page-${n}.png`),'stdout','-l','ara+eng','--psm','6'],{timeout:30000,maxBuffer:1024*1024}); text += x.stdout + '\\n'; }
        limited = pages > 3;
      } finally { await rm(dir,{ recursive:true,force:true }); }
    }
  } else if (file.mime.startsWith('text/plain')) {
    text = (await readFile(file.file)).toString('utf8');
  } else if (file.mime.includes('spreadsheetml')) {
    const buf = await readFile(file.file); const zip = await JSZip.loadAsync(buf);
    const files = Object.values(zip.files);
    const size = files.reduce((n,f) => n + Number((f as any)._data?.uncompressedSize || 0),0);
    if (files.length > 2000 || size > 30*1024*1024) throw new Error('ملف Excel كبير أو معقد أكثر من الحد الآمن');
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as any);
    let rows = 0; const lines: string[] = [];
    for (const ws of wb.worksheets.slice(0,10)) { lines.push(`ورقة: ${ws.name}`); ws.eachRow((row) => { if (rows++ >= 1000) { limited=true; return; } const vals = Array.isArray(row.values) ? row.values.slice(1,51) : []; lines.push(vals.map(v => { if (v && typeof v === 'object') return 'text' in v ? String(v.text) : 'result' in v ? String(v.result ?? '') : ''; return String(v ?? ''); }).join(' | ')); }); }
    text = lines.join('\n');
  } else throw new Error('تحليل هذا النوع غير مدعوم حالياً؛ الصوت والفيديو بحاجة تحويل كلام إلى نص');
  if (text.length > 30000) { text = text.slice(0,30000); limited = true; }
  const candidates = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => ({ line, parsed: parseOperationText(line) || parseConfirmedVodafone(line) })).filter(x => x.parsed).slice(0,50);
  return { text: text.trim(), limited, candidates, notice: 'النص المقروء احتمالي ويجب مراجعته. لم تُنشأ أو تُرحّل أي حركة.' };
}
