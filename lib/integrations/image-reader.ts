/** تحسين محلي للقراءة؛ النص المُحسّن اقتراح للمراجعة فقط وليس دليلاً للترحيل. */
import fs from 'node:fs';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
export function tesseractExecutable(): string {
  const configured = process.env.TESSERACT_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files']) {
      if (base) { const file=path.join(base,'Tesseract-OCR','tesseract.exe'); if (fs.existsSync(file)) return file; }
    }
  }
  return 'tesseract';
}
async function ocr(file:string, psm:'3'|'6') {
  return (await exec(tesseractExecutable(),[file,'stdout','-l','ara+eng','--psm',psm],{timeout:30000,maxBuffer:1024*1024})).stdout;
}
function score(s:string) {
  // اختيار قراءة أغنى للعرض لا يعني أن الأرقام صحيحة.
  return Math.min((s.match(/[\p{L}\p{N}]/gu) || []).length, 3000) + (s.includes('بنجاح') ? 30 : 0) + (/ناجحة/u.test(s) ? 30 : 0);
}
export async function readImageOcr(file:string, twoRaw=true) {
  const original = await ocr(file,'6');
  const second = twoRaw ? await ocr(file,'3') : '';
  let enhanced = '';
  let dir = '';
  try {
    // sharp تبعية اختيارية في Next. إن لم تتوفر (مثلاً Termux) نبقي القراءة الأصلية.
    const sharp = (await import('sharp')).default;
    const source = sharp(file,{ limitInputPixels:25_000_000, failOn:'error' });
    const meta = await source.metadata();
    if (!meta.width || !meta.height || meta.width * meta.height > 25_000_000) throw new Error('أبعاد الصورة كبيرة');
    dir = await mkdtemp(path.join(tmpdir(),'nasr-ocr-prep-'));
    const improved=path.join(dir,'enhanced.png');
    const width = Math.min(2000,Math.max(meta.width,1600));
    await source.rotate().flatten({background:'#ffffff'}).resize({width,withoutEnlargement:false}).grayscale().normalize().png().toFile(improved);
    enhanced = await ocr(improved,'6');
  } catch (e) { console.warn('[ocr] تحسين الصورة غير متاح:', (e as Error).message); }
  finally { if(dir) await rm(dir,{recursive:true,force:true}); }
  const choices = [original,second,enhanced].filter(s=>s.trim());
  choices.sort((a,b)=>score(b)-score(a));
  return { original, second, enhanced, text:(choices[0] || '').trim() };
}
