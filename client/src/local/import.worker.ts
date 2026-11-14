import { parseImport, type ImportKind, type ImportOptions } from './analysis';
self.onmessage = (event: MessageEvent<{ input: string; kind: ImportKind; options: ImportOptions }>) => {
  try { self.postMessage({ result: parseImport(event.data.input, event.data.kind, event.data.options) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not parse file.' }); }
};
