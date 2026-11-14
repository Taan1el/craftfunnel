export const MAX_FILE = 32 * 1024 * 1024;
export const MAX_ROWS = 100_000;
export interface EventRow { user: string; event: string; time: number }
export interface MoneyRow { id: string; amount: string; currency: string; row: number; date?: string }
// Currency and date are optional columns; an empty name means the file has none.
export interface Mapping { id: string; amount: string; currency: string; date?: string }
export interface ImportOptions { mapping: Mapping; defaultCurrency?: string }
export interface ImportReport { imported: number; skipped: number; reasons: string[]; hint?: string; delimiter?: string }
export interface Workspace {
  version: 1;
  events: EventRow[];
  steps: string[];
  payments: MoneyRow[];
  orders: MoneyRow[];
  experiment: [number, number, number, number];
  sizing: [number, number];
}
export const emptyWorkspace = (): Workspace => ({ version: 1, events: [], steps: ['visit', 'signup', 'purchase'], payments: [], orders: [], experiment: [1000, 100, 1000, 125], sizing: [10, 2] });

function fail(message: string): never { throw new Error(message); }
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 500 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

type Delimiter = ',' | ';' | '\t';
interface CsvRecord { cells: string[]; line: number; error?: string }
const DELIMITER_NAMES: Record<Delimiter, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab' };
const REASONS_SHOWN = 3;

// Pick comma, semicolon or tab from the header line, ignoring characters inside quotes. Ties prefer comma.
export function detectDelimiter(input: string): Delimiter {
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 }; let quoted = false; let seen = false;
  for (const character of input.replace(/^﻿/, '')) {
    if (character === '"') quoted = !quoted;
    else if (!quoted && (character === '\n' || character === '\r')) { if (seen) break; continue; }
    else if (!quoted && character in counts) counts[character as Delimiter]++;
    seen = true;
  }
  let best: Delimiter = ',';
  for (const candidate of [';', '\t'] as const) if (counts[candidate] > counts[best]) best = candidate;
  return best;
}

// RFC 4180 fields, including escaped quotes and embedded newlines. Each record keeps the physical line it starts on.
// A stray quote only marks its own record; an unclosed quote ends the scan because the rest of the file is ambiguous.
function scanCsv(input: string): { records: CsvRecord[]; delimiter: Delimiter } {
  if (new TextEncoder().encode(input).length > MAX_FILE) fail('File exceeds 32 MiB. Split the export into smaller files.');
  const source = input.replace(/^﻿/, ''); const delimiter = detectDelimiter(source);
  const records: CsvRecord[] = []; let row: string[] = []; let field = ''; let quoted = false; let closed = false; let line = 1; let start = 1; let problem = '';
  const pushField = () => { row.push(field); field = ''; closed = false; if (row.length > 200) fail(`Line ${start}: more than 200 columns.`); };
  const pushRow = () => { pushField(); if (row.some(cell => cell !== '')) { records.push({ cells: row, line: start, ...(problem ? { error: problem } : {}) }); if (records.length > MAX_ROWS + 1) fail('More than 100000 data rows. Split the export.'); } row = []; problem = ''; };
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"') { if (source[index + 1] === '"') { field += '"'; index++; } else { quoted = false; closed = true; } }
      else { field += character; if (character === '\n' || (character === '\r' && source[index + 1] !== '\n')) line++; }
    } else if (character === '"') { if (field || closed) { problem ||= 'quote inside an unquoted field.'; field += character; } else quoted = true; }
    else if (character === delimiter) pushField();
    else if (character === '\n' || character === '\r') { if (character === '\r' && source[index + 1] === '\n') index++; pushRow(); line++; start = line; }
    else { if (closed) problem ||= 'unexpected text after closing quote.'; field += character; }
    if (field.length > 100_000) fail(`Line ${start}: field exceeds 100000 characters.`);
  }
  if (quoted) fail(`Line ${start}: unclosed quoted field.`);
  if (field || row.length || closed) pushRow();
  return { records, delimiter };
}
function readTable(input: string) {
  const { records, delimiter } = scanCsv(input);
  if (records.length < 2) fail('Expected a header and at least one data row.');
  if (records[0].error) fail(`Line ${records[0].line}: ${records[0].error}`);
  const headers = records[0].cells.map(cell => cell.trim());
  if (headers.some(cell => !cell) || new Set(headers).size !== headers.length) fail('Header names must be nonempty and unique.');
  return { headers, data: records.slice(1), delimiter };
}
// Strict reader: any malformed record rejects the file. Comma, semicolon or tab is detected from the header.
export function parseCsv(input: string): string[][] {
  const { headers, data } = readTable(input);
  for (const record of data) { if (record.error) fail(`Line ${record.line}: ${record.error}`); if (record.cells.length !== headers.length) fail(`Line ${record.line}: expected ${headers.length} columns, found ${record.cells.length}.`); }
  return [headers, ...data.map(record => record.cells)];
}
// Row-level reader: bad rows are skipped and reported. The file fails only when no row is good or more than half are bad.
function importRows<T>(data: CsvRecord[], columnCount: number, delimiter: Delimiter, convert: (cells: string[], line: number) => T): { rows: T[]; report: ImportReport } {
  const rows: T[] = []; const reasons: string[] = []; let skipped = 0;
  for (const record of data) {
    try {
      if (record.error) fail(record.error);
      if (record.cells.length !== columnCount) fail(`expected ${columnCount} columns, found ${record.cells.length}.`);
      rows.push(convert(record.cells, record.line));
    } catch (error) { skipped++; if (reasons.length < REASONS_SHOWN) reasons.push(`Line ${record.line}: ${(error as Error).message}`); }
  }
  const report: ImportReport = { imported: rows.length, skipped, reasons, ...(reasons.some(reason => reason.includes('timestamp')) ? { hint: `Accepted timestamps: ${TIME_FORMATS}` } : {}), ...(delimiter === ',' ? {} : { delimiter: DELIMITER_NAMES[delimiter] }) };
  if (!rows.length || skipped * 2 > data.length) fail(`${rows.length ? `More than half of the rows are invalid (${skipped} of ${data.length}).` : `No valid rows (${skipped} of ${data.length} invalid).`} Nothing was imported.\n${[...reasons, ...(report.hint ? [report.hint] : [])].join('\n')}`);
  return { rows, report };
}
export function describeImport(report: ImportReport): string {
  const lines = [`Imported ${report.imported} row${report.imported === 1 ? '' : 's'}, skipped ${report.skipped}.`];
  if (report.delimiter) lines.push(`Detected a ${report.delimiter}-delimited file.`);
  lines.push(...report.reasons);
  if (report.skipped > report.reasons.length) lines.push(`and ${report.skipped - report.reasons.length} more skipped.`);
  if (report.hint) lines.push(report.hint);
  return lines.join('\n');
}

const TIME_FORMATS = 'YYYY-MM-DD; YYYY-MM-DD HH:mm, HH:mm:ss or HH:mm:ss.f with 1 to 9 fraction digits (T or a space between date and time; UTC unless Z or an offset such as +02:00, +0200 or +02 is given); Unix epoch seconds or milliseconds (10 or 13 digits).';
export function parseTime(value: string): number {
  const input = value.trim();
  // Epoch values are unambiguous at exactly 10 (seconds) or 13 (milliseconds) digits.
  if (/^\d{10}$/.test(input)) return Number(input) * 1000;
  if (/^\d{13}$/.test(input)) return Number(input);
  // Date-only and unzoned timestamps are UTC. A zone keeps its offset.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/.exec(input);
  if (!match) fail(`Timestamp not recognized. Accepted: ${TIME_FORMATS} Ambiguous formats such as 01/02/2024 are rejected.`);
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', zone = 'Z'] = match;
  const date = new Date(0); date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  const digits = zone === 'Z' ? '' : zone.slice(1).replace(':', ''); const offsetHours = Number(digits.slice(0, 2)); const offsetMinutes = Number(digits.slice(2) || '0');
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || offsetHours > 23 || offsetMinutes > 59) fail('Invalid calendar date or time.');
  // Sub-millisecond digits are accepted and ignored; equal timestamps keep file order.
  date.setUTCHours(Number(hour), Number(minute), Number(second), Number(fraction.padEnd(3, '0').slice(0, 3)));
  const offset = zone === 'Z' ? 0 : (zone[0] === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes) * 60_000;
  return date.getTime() - offset;
}
// True when every event sits exactly at UTC midnight, which is what date-only timestamps produce.
export const hasDayResolution = (events: EventRow[]): boolean => events.length > 0 && events.every(event => event.time % 86_400_000 === 0);

export function importEvents(input: string): { rows: EventRow[]; report: ImportReport } {
  const { headers, data, delimiter } = readTable(input);
  const columns = ['user_id', 'event', 'timestamp'].map(name => { const index = headers.indexOf(name); if (index < 0) fail(`Missing required column ${name}.`); return index; });
  return importRows(data, headers.length, delimiter, cells => {
    const [user, event, timestamp] = columns.map(column => cells[column].trim());
    if (!text(user) || !text(event)) fail('user_id and event must contain 1 to 500 characters.');
    try { return { user, event, time: parseTime(timestamp) }; } catch { return fail(`timestamp "${timestamp.slice(0, 40)}" is not an accepted format or not a real date.`); }
  });
}
export const parseEvents = (input: string): EventRow[] => importEvents(input).rows;

export function validateSteps(steps: string[]): string[] {
  const result = steps.map(step => step.trim());
  if (result.length < 2 || result.length > 10 || result.some(step => !text(step)) || new Set(result).size !== result.length) fail('Use 2 to 10 distinct, nonempty step names, one per line (maximum 500 characters each).');
  return result;
}
export function funnel(events: EventRow[], steps: string[], period: 'day' | 'month') {
  validateSteps(steps);
  const users = new Map<string, EventRow[]>();
  for (const event of events) { const list = users.get(event.user) ?? []; list.push(event); users.set(event.user, list); }
  const totals = steps.map(() => 0); const periods = new Map<string, number[]>();
  for (const list of users.values()) {
    // The sort is stable, so events with the same timestamp keep their file order and a later row can satisfy the next step.
    list.sort((a, b) => a.time - b.time);
    // A user's first entry sets the UTC cohort. Later steps can finish in a later period.
    const entry = list.find(row => row.event === steps[0]);
    if (!entry) continue;
    const key = new Date(entry.time).toISOString().slice(0, period === 'day' ? 10 : 7);
    const counts = periods.get(key) ?? steps.map(() => 0); periods.set(key, counts);
    let next = 0;
    for (const event of list) if (event.event === steps[next]) { totals[next]++; counts[next]++; next++; if (next === steps.length) break; }
  }
  return { totals, periods: [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)) };
}

// Compare decimal values exactly, without currency exponents or floating-point rounding.
export function decimal(value: string): string {
  if (!/^-?\d{1,18}(?:\.\d{1,8})?$/.test(value.trim())) fail('Expected a plain decimal amount in major currency units (no grouping, exponent, or symbol).');
  const [whole, fraction = ''] = value.trim().replace(/^-/, '').split('.');
  const integer = whole.replace(/^0+(?=\d)/, ''); const digits = fraction.replace(/0+$/, '');
  const result = integer + (digits ? `.${digits}` : '');
  return value.trim().startsWith('-') && result !== '0' ? `-${result}` : result;
}
// Amounts have at most 8 decimals, so they are summed as BigInt multiples of 1e-8. No floating point is involved.
const SCALE = 8;
const ZERO = BigInt(0);
const toUnits = (amount: string): bigint => { const [whole, fraction = ''] = amount.replace('-', '').split('.'); const value = BigInt(whole + fraction.padEnd(SCALE, '0')); return amount.startsWith('-') ? -value : value; };
const fromUnits = (value: bigint): string => { const digits = (value < ZERO ? -value : value).toString().padStart(SCALE + 1, '0'); const fraction = digits.slice(-SCALE).replace(/0+$/, ''); return `${value < ZERO ? '-' : ''}${digits.slice(0, -SCALE)}${fraction ? `.${fraction}` : ''}`; };

export function importMoney(input: string, options: ImportOptions): { rows: MoneyRow[]; report: ImportReport } {
  const { mapping } = options; const fallback = (options.defaultCurrency ?? '').trim();
  const { headers, data, delimiter } = readTable(input);
  const named = [mapping.id, mapping.amount, mapping.currency ?? '', mapping.date ?? ''];
  const [id, amount, currency, date] = named.map((name, position) => {
    if (position > 1 && !name) return -1;
    const index = headers.indexOf(name); if (index < 0) fail(`Missing mapped column ${name || '(empty)'}. Column names are case-sensitive.`); return index;
  });
  const used = [id, amount, currency, date].filter(index => index >= 0);
  if (new Set(used).size !== used.length) fail('ID, amount, currency, and date must use different columns.');
  if (currency < 0 && !/^[A-Za-z]{3}$/.test(fallback)) fail('Name a currency column or enter a default currency of three letters, for example USD.');
  if (fallback && !/^[A-Za-z]{3}$/.test(fallback)) fail('Default currency must be three letters, for example USD.');
  return importRows(data, headers.length, delimiter, (cells, line) => {
    const key = cells[id].trim();
    if (!text(key)) fail('ID must contain 1 to 500 characters.');
    const code = (currency >= 0 ? cells[currency].trim() : '') || fallback;
    if (!/^[A-Za-z]{3}$/.test(code)) fail(code ? 'expected a three-letter currency code.' : 'currency is empty and no default currency was entered.');
    const when = date >= 0 ? cells[date].trim() : '';
    if (when.length > 500) fail('date exceeds 500 characters.');
    try { return { id: key, amount: decimal(cells[amount]), currency: code.toUpperCase(), row: line, ...(when ? { date: when } : {}) }; } catch (error) { return fail(`amount: ${(error as Error).message}`); }
  });
}
export const parseMoney = (input: string, mapping: Mapping, defaultCurrency = ''): MoneyRow[] => importMoney(input, { mapping, defaultCurrency }).rows;

export interface Discrepancy { type: string; id: string; payment: string; order: string; rows: string; currency?: string; paymentNet?: string; orderNet?: string }
interface Net { total: bigint; count: number }
// Net totals per currency compare charges, refunds, and split payments as one balance per ID. Equal repeated rows are listed apart.
export function reconcile(payments: MoneyRow[], orders: MoneyRow[], options: { ignoreIdCase?: boolean } = {}): { matched: number; discrepancies: Discrepancy[] } {
  const fold = (id: string) => options.ignoreIdCase === false ? id : id.toLowerCase();
  const group = (rows: MoneyRow[]) => { const map = new Map<string, MoneyRow[]>(); for (const row of rows) { const list = map.get(fold(row.id)) ?? []; list.push(row); map.set(fold(row.id), list); } return map; };
  const net = (rows: MoneyRow[]) => { const map = new Map<string, Net>(); for (const row of rows) { const entry = map.get(row.currency) ?? { total: ZERO, count: 0 }; entry.total += toUnits(row.amount); entry.count++; map.set(row.currency, entry); } return map; };
  const repeats = (rows: MoneyRow[]) => { const map = new Map<string, MoneyRow[]>(); for (const row of rows) { const key = JSON.stringify([row.currency, row.amount, row.date ?? '']); const list = map.get(key) ?? []; list.push(row); map.set(key, list); } return [...map.values()].filter(list => list.length > 1); };
  const describeNet = (map: Map<string, Net>) => [...map].map(([currency, { total, count }]) => `${fromUnits(total)} ${currency}${count > 1 ? ` (${count} rows)` : ''}`).join('; ');
  const describeRepeats = (lists: MoneyRow[][]) => lists.map(list => `${list[0].amount} ${list[0].currency}${list[0].date ? ` on ${list[0].date}` : ''} in ${list.length} identical rows`).join('; ');
  const lines = (rows: MoneyRow[]) => rows.map(row => row.row).join(', ') || 'none';
  const p = group(payments); const o = group(orders); let matched = 0; const discrepancies: Discrepancy[] = [];
  for (const key of new Set([...p.keys(), ...o.keys()])) {
    const paid = p.get(key) ?? []; const ordered = o.get(key) ?? []; const id = (paid[0] ?? ordered[0]).id;
    const paidNet = net(paid); const orderedNet = net(ordered); const currencies = [...new Set([...paidNet.keys(), ...orderedNet.keys()])];
    const single = currencies.length === 1 ? currencies[0] : '';
    const numbers = { currency: single, paymentNet: single && paidNet.has(single) ? fromUnits(paidNet.get(single)!.total) : '', orderNet: single && orderedNet.has(single) ? fromUnits(orderedNet.get(single)!.total) : '' };
    let type = '';
    if (!paid.length) type = 'missing payment';
    else if (!ordered.length) type = 'missing order';
    else if (currencies.some(currency => (paidNet.get(currency)?.total ?? ZERO) !== (orderedNet.get(currency)?.total ?? ZERO))) type = 'mismatch';
    else matched++;
    if (type) discrepancies.push({ type, id, payment: describeNet(paidNet), order: describeNet(orderedNet), rows: `payments: ${lines(paid)}; orders: ${lines(ordered)}`, ...numbers });
    const paidRepeats = repeats(paid); const orderedRepeats = repeats(ordered);
    if (paidRepeats.length || orderedRepeats.length) discrepancies.push({ type: 'duplicate', id, payment: describeRepeats(paidRepeats), order: describeRepeats(orderedRepeats), rows: `payments: ${lines(paidRepeats.flat())}; orders: ${lines(orderedRepeats.flat())}`, ...numbers });
  }
  return { matched, discrepancies };
}
export function discrepancyCsv(rows: Discrepancy[]): string {
  // Prefix formula-leading text so spreadsheet applications treat IDs as text. Plain numbers, including negative ones, stay numeric.
  const cell = (value: string) => `"${(!/^-?\d+(?:\.\d+)?$/.test(value) && /^[\s]*[=+\-@\t\r\n]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
  return '﻿' + ['type,id,payment,order,rows,currency,payment_net,order_net', ...rows.map(row => [row.type, row.id, row.payment, row.order, row.rows, row.currency ?? '', row.paymentNet ?? '', row.orderNet ?? ''].map(cell).join(','))].join('\r\n');
}

function cdf(z: number): number {
  // Abramowitz and Stegun 7.1.26.
  const x = Math.abs(z) / Math.SQRT2; const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return (1 + (z < 0 ? -erf : erf)) / 2;
}
// Four decimals, with a floor so tiny values never print as 0.0000.
export const formatP = (p: number): string => p < 0.0001 ? 'p < 0.0001' : `p = ${p.toFixed(4)}`;
export function experiment(values: number[]) {
  const [na, xa, nb, xb] = values;
  if (values.length !== 4 || values.some(value => !Number.isSafeInteger(value) || value < 0 || value > 1e9) || na < 1 || nb < 1 || xa > na || xb > nb) fail('Visitors must be positive whole numbers up to 1 billion; conversions must be between zero and visitors.');
  const a = xa / na; const b = xb / nb; const pooled = (xa + xb) / (na + nb); const se = Math.sqrt(pooled * (1 - pooled) * (1 / na + 1 / nb));
  const z = se ? (b - a) / se : 0;
  const margin = 1.95996398454 * Math.sqrt(a * (1 - a) / na + b * (1 - b) / nb);
  const reliable = [xa, na - xa, xb, nb - xb].every(value => value >= 10);
  return { a, b, difference: b - a, z, p: Math.min(1, Math.max(0, 2 * (1 - cdf(Math.abs(z))))), low: Math.max(-1, b - a - margin), high: Math.min(1, b - a + margin), reliable };
}
export function sampleSize(baselinePercent: number, liftPoints: number): number {
  if (typeof baselinePercent !== 'number' || typeof liftPoints !== 'number') fail('Baseline and lift must be numbers.');
  const a = baselinePercent / 100; const b = a + liftPoints / 100;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || a >= 1 || liftPoints <= 0 || b >= 1) fail('Baseline must be between 0 and 100%; positive detectable lift must keep the target below 100%.');
  const mean = (a + b) / 2;
  const result = Math.ceil((1.95996398454 * Math.sqrt(2 * mean * (1 - mean)) + 0.84162123357 * Math.sqrt(a * (1 - a) + b * (1 - b))) ** 2 / (b - a) ** 2);
  if (!Number.isSafeInteger(result) || result > 1e9) fail('Required sample exceeds 1 billion visitors per variant. Choose a larger detectable lift.');
  return result;
}

export function parseBackup(input: string): Workspace {
  if (new TextEncoder().encode(input).length > MAX_FILE) fail('Backup exceeds 32 MiB.');
  let value: unknown; try { value = JSON.parse(input); } catch { return fail('Expected a valid workspace JSON file.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected a workspace object.');
  const data = value as Workspace;
  if (data.version !== 1) fail('Unsupported workspace version; expected 1.');
  if (!Array.isArray(data.steps) || data.steps.some(step => typeof step !== 'string')) fail('Expected a steps array.');
  const steps = validateSteps(data.steps);
  if (!Array.isArray(data.events) || data.events.length > MAX_ROWS || data.events.some(row => !row || !text(row.user) || !text(row.event) || !Number.isFinite(row.time) || !Number.isFinite(new Date(row.time).getTime()))) fail('Expected at most 100000 valid events.');
  for (const key of ['payments', 'orders'] as const) {
    if (!Array.isArray(data[key]) || data[key].length > MAX_ROWS || data[key].some(row => !row || !text(row.id) || typeof row.amount !== 'string' || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency) || !Number.isInteger(row.row) || row.row < 2 || (row.date !== undefined && !text(row.date)))) fail(`Invalid ${key} rows.`);
    for (const row of data[key]) if (decimal(row.amount) !== row.amount) fail(`Noncanonical ${key} amount.`);
  }
  if (!Array.isArray(data.experiment) || !Array.isArray(data.sizing) || data.sizing.length !== 2) fail('Missing experiment settings.');
  experiment(data.experiment); sampleSize(...data.sizing);
  // Copy only schema fields; unrecognized properties never enter saved state.
  const money = ({ id, amount, currency, row, date }: MoneyRow): MoneyRow => ({ id, amount, currency, row, ...(date === undefined ? {} : { date }) });
  return { version: 1, steps, events: data.events.map(({ user, event, time }) => ({ user, event, time })), payments: data.payments.map(money), orders: data.orders.map(money), experiment: [...data.experiment], sizing: [...data.sizing] };
}

export type ImportKind = 'events' | 'payments' | 'orders' | 'backup';
export interface ImportResult { data: Workspace | EventRow[] | MoneyRow[]; report?: ImportReport }
export function parseImport(input: string, kind: ImportKind, options: ImportOptions): ImportResult {
  if (kind === 'backup') return { data: parseBackup(input) };
  const { rows, report } = kind === 'events' ? importEvents(input) : importMoney(input, options);
  return { data: rows, report };
}
