/**
 * مخزن ملفّي بسيط (JSON على القرص) — بديل مؤقت لقاعدة البيانات.
 *
 * - المسار: `${DATA_DIR}/<name>.json` (الافتراضي `./data`)
 *   في Docker يُثبَّت حجم دائم على `/data` حتى لا تُفقد البيانات عند إعادة النشر.
 * - الكتابة ذرّية (ملف مؤقت + rename) حتى لا يتلف الملف إذا انقطع التيار أثناء الكتابة.
 * - للانتقال إلى قاعدة بيانات حقيقية: استبدل `readJson` / `writeJson` فقط.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

function ensureDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

export function dataFile(name: string) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readJson<T>(name: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(dataFile(name), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(name: string, value: unknown): boolean {
  try {
    ensureDir();
    const target = dataFile(name);
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, target);
    return true;
  } catch (err) {
    console.error('[store] فشل الحفظ:', name, err);
    return false;
  }
}

/** حجم الملف بالبايت (لعرضه في صفحة الصحة) — أو 0 إن لم يكن موجودًا */
export function fileSize(name: string) {
  try {
    return fs.statSync(dataFile(name)).size;
  } catch {
    return 0;
  }
}
