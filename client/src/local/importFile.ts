import { MAX_FILE, parseImport, type ImportKind, type ImportOptions, type ImportResult } from './analysis';
export async function importFile(file: File, kind: ImportKind, options: ImportOptions): Promise<ImportResult> {
  if (file.size > MAX_FILE) throw new Error(`${file.name}: exceeds 32 MiB.`);
  try {
    const input = await file.text();
    if (file.size < 1024 * 1024) return parseImport(input, kind, options);
    return await new Promise<ImportResult>((resolve, reject) => {
      const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Parsing took too long. Split the file.')); }, 30_000);
      const finish = () => { clearTimeout(timer); worker.terminate(); };
      worker.onmessage = event => { finish(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result); };
      worker.onerror = () => { finish(); reject(new Error('File worker could not parse this file.')); };
      worker.postMessage({ input, kind, options });
    });
  } catch (error) { throw new Error(`${file.name}: ${(error as Error).message}`); }
}
