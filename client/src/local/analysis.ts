export const MAX_FILE = 32 * 1024 * 1024;
export const MAX_ROWS = 100_000;
export interface EventRow { user: string; event: string; time: number }
export interface MoneyRow { id: string; amount: string; currency: string; row: number }
export interface Mapping { id: string; amount: string; currency: string }
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

// RFC 4180 fields, including escaped quotes and embedded newlines. No delimiter guessing.
export function parseCsv(input: string): string[][] {
  if (new TextEncoder().encode(input).length > MAX_FILE) fail('File exceeds 32 MiB. Split the export into smaller files.');
  const source = input.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false; let closed = false;
  const pushField = () => { row.push(field); field = ''; closed = false; if (row.length > 200) fail(`Row ${rows.length + 1}: more than 200 columns.`); };
  const pushRow = () => { pushField(); if (row.some(cell => cell !== '')) rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) fail('More than 100000 data rows. Split the export.'); };
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"') { if (source[index + 1] === '"') { field += '"'; index++; } else { quoted = false; closed = true; } }
      else field += character;
    } else if (character === '"') { if (field || closed) fail(`Row ${rows.length + 1}: quote inside an unquoted field.`); quoted = true; }
    else if (character === ',') pushField();
    else if (character === '\n' || character === '\r') { if (character === '\r' && source[index + 1] === '\n') index++; pushRow(); }
    else { if (closed) fail(`Row ${rows.length + 1}: unexpected text after closing quote.`); field += character; }
    if (field.length > 100_000) fail(`Row ${rows.length + 1}: field exceeds 100000 characters.`);
  }
  if (quoted) fail(`Row ${rows.length + 1}: unclosed quoted field.`);
  if (field || row.length || closed) pushRow();
  if (rows.length < 2) fail('Expected a header and at least one data row.');
  const headers = rows[0].map(cell => cell.trim());
  if (headers.some(cell => !cell) || new Set(headers).size !== headers.length) fail('Header names must be nonempty and unique.');
  rows[0] = headers;
  for (let index = 1; index < rows.length; index++) if (rows[index].length !== headers.length) fail(`Row ${index + 1}: expected ${headers.length} columns, found ${rows[index].length}.`);
  return rows;
}

export function parseTime(value: string): number {
  // Date-only and SQL-style timestamps are explicitly UTC. Zoned ISO retains its offset.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:(?:T| )(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value.trim());
  if (!match) fail('Expected YYYY-MM-DD, YYYY-MM-DD HH:mm:ss (UTC), or ISO timestamp with an offset.');
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', zone = 'Z'] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) fail('Invalid calendar date or time.');
  const result = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone}`);
  if (!Number.isFinite(result)) fail('Invalid timestamp.');
  return result;
}

export function parseEvents(input: string): EventRow[] {
  const [headers, ...rows] = parseCsv(input);
  const columns = ['user_id', 'event', 'timestamp'].map(name => { const index = headers.indexOf(name); if (index < 0) fail(`Missing required column ${name}.`); return index; });
  return rows.map((row, index) => {
    const [user, event, timestamp] = columns.map(column => row[column].trim());
    if (!text(user) || !text(event)) fail(`Row ${index + 2}: user_id and event must contain 1 to 500 characters.`);
    try { return { user, event, time: parseTime(timestamp) }; } catch (error) { return fail(`Row ${index + 2}, timestamp: ${(error as Error).message}`); }
  });
}

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
    list.sort((a, b) => a.time - b.time);
    // A user's first entry sets the UTC cohort. Later steps can finish in a later period.
    const entry = list.find(row => row.event === steps[0]);
    if (!entry) continue;
    const key = new Date(entry.time).toISOString().slice(0, period === 'day' ? 10 : 7);
    const counts = periods.get(key) ?? steps.map(() => 0); periods.set(key, counts);
    let next = 0; let last = -Infinity;
    for (const event of list) if (event.event === steps[next] && event.time > last) { totals[next]++; counts[next]++; next++; last = event.time; if (next === steps.length) break; }
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
export function parseMoney(input: string, mapping: Mapping): MoneyRow[] {
  const [headers, ...rows] = parseCsv(input);
  const columns = [mapping.id, mapping.amount, mapping.currency].map(name => { const index = headers.indexOf(name); if (index < 0) fail(`Missing mapped column ${name || '(empty)'}. Column names are case-sensitive.`); return index; });
  if (new Set(columns).size !== 3) fail('ID, amount, and currency must use different columns.');
  return rows.map((row, index) => {
    const [id, amount, currency] = columns.map(column => row[column].trim());
    if (!text(id)) fail(`Row ${index + 2}: ID must contain 1 to 500 characters.`);
    if (!/^[A-Za-z]{3}$/.test(currency)) fail(`Row ${index + 2}: expected a three-letter currency code.`);
    try { return { id, amount: decimal(amount), currency: currency.toUpperCase(), row: index + 2 }; } catch (error) { return fail(`Row ${index + 2}, amount: ${(error as Error).message}`); }
  });
}
export interface Discrepancy { type: string; id: string; payment: string; order: string; rows: string }
export function reconcile(payments: MoneyRow[], orders: MoneyRow[]): { matched: number; discrepancies: Discrepancy[] } {
  const group = (rows: MoneyRow[]) => { const map = new Map<string, MoneyRow[]>(); for (const row of rows) { const list = map.get(row.id) ?? []; list.push(row); map.set(row.id, list); } return map; };
  const p = group(payments); const o = group(orders); let matched = 0; const discrepancies: Discrepancy[] = [];
  const describe = (rows: MoneyRow[]) => rows.map(row => `${row.amount} ${row.currency}`).join('; ');
  for (const id of new Set([...p.keys(), ...o.keys()])) {
    const paid = p.get(id) ?? []; const ordered = o.get(id) ?? [];
    let type = '';
    if (paid.length > 1 || ordered.length > 1) type = 'duplicate';
    else if (!paid.length) type = 'missing payment';
    else if (!ordered.length) type = 'missing order';
    else if (paid[0].amount !== ordered[0].amount || paid[0].currency !== ordered[0].currency) type = 'mismatch';
    else matched++;
    if (type) discrepancies.push({ type, id, payment: describe(paid), order: describe(ordered), rows: `payments: ${paid.map(row => row.row).join(', ') || 'none'}; orders: ${ordered.map(row => row.row).join(', ') || 'none'}` });
  }
  return { matched, discrepancies };
}
export function discrepancyCsv(rows: Discrepancy[]): string {
  // Prefix formula-leading cells so spreadsheet applications treat IDs as text.
  const cell = (value: string) => `"${(/^[\s]*[=+\-@\t\r\n]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
  return '\uFEFF' + ['type,id,payment,order,rows', ...rows.map(row => [row.type, row.id, row.payment, row.order, row.rows].map(cell).join(','))].join('\r\n');
}

function cdf(z: number): number {
  // Abramowitz and Stegun 7.1.26.
  const x = Math.abs(z) / Math.SQRT2; const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return (1 + (z < 0 ? -erf : erf)) / 2;
}
export function experiment(values: number[]) {
  const [na, xa, nb, xb] = values;
  if (values.length !== 4 || values.some(value => !Number.isSafeInteger(value) || value < 0 || value > 1e9) || na < 1 || nb < 1 || xa > na || xb > nb) fail('Visitors must be positive whole numbers up to 1 billion; conversions must be between zero and visitors.');
  const a = xa / na; const b = xb / nb; const pooled = (xa + xb) / (na + nb); const se = Math.sqrt(pooled * (1 - pooled) * (1 / na + 1 / nb));
  const z = se ? (b - a) / se : 0;
  const margin = 1.95996398454 * Math.sqrt(a * (1 - a) / na + b * (1 - b) / nb);
  const reliable = [xa, na - xa, xb, nb - xb].every(value => value >= 10);
  return { a, b, difference: b - a, z, p: 2 * (1 - cdf(Math.abs(z))), low: Math.max(-1, b - a - margin), high: Math.min(1, b - a + margin), reliable };
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
    if (!Array.isArray(data[key]) || data[key].length > MAX_ROWS || data[key].some(row => !row || !text(row.id) || typeof row.amount !== 'string' || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency) || !Number.isInteger(row.row) || row.row < 2)) fail(`Invalid ${key} rows.`);
    for (const row of data[key]) if (decimal(row.amount) !== row.amount) fail(`Noncanonical ${key} amount.`);
  }
  if (!Array.isArray(data.experiment) || !Array.isArray(data.sizing) || data.sizing.length !== 2) fail('Missing experiment settings.');
  experiment(data.experiment); sampleSize(...data.sizing);
  // Copy only schema fields; unrecognized properties never enter saved state.
  return { version: 1, steps, events: data.events.map(({ user, event, time }) => ({ user, event, time })), payments: data.payments.map(({ id, amount, currency, row }) => ({ id, amount, currency, row })), orders: data.orders.map(({ id, amount, currency, row }) => ({ id, amount, currency, row })), experiment: [...data.experiment], sizing: [...data.sizing] };
}

export type ImportKind = 'events' | 'payments' | 'orders' | 'backup';
export function parseImport(input: string, kind: ImportKind, mapping: Mapping) {
  return kind === 'backup' ? parseBackup(input) : kind === 'events' ? parseEvents(input) : parseMoney(input, mapping);
}
