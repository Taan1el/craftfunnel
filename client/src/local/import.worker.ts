import { parseImport, type ImportKind, type Mapping } from './analysis';
self.onmessage = (event: MessageEvent<{ input: string; kind: ImportKind; mapping: Mapping }>) => {
  try { self.postMessage({ data: parseImport(event.data.input, event.data.kind, event.data.mapping) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not parse file.' }); }
};
