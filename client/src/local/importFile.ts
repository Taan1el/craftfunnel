import { MAX_FILE, parseImport, type ImportKind, type Mapping } from './analysis';
export async function importFile(file: File, kind: ImportKind, mapping: Mapping): Promise<ReturnType<typeof parseImport>> {
  if (file.size > MAX_FILE) throw new Error(`${file.name}: exceeds 32 MiB.`);
  try {
    const input = await file.text();
    if (file.size < 1024 * 1024) return parseImport(input, kind, mapping);
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Parsing took too long. Split the file.')); }, 30_000);
      const finish = () => { clearTimeout(timer); worker.terminate(); };
      worker.onmessage = event => { finish(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.data); };
      worker.onerror = () => { finish(); reject(new Error('File worker could not parse this file.')); };
      worker.postMessage({ input, kind, mapping });
    });
  } catch (error) { throw new Error(`${file.name}: ${(error as Error).message}`); }
}
