import { describe, expect, it } from 'vitest';
import { decimal, describeImport, detectDelimiter, discrepancyCsv, emptyWorkspace, experiment, formatP, funnel, hasDayResolution, importEvents, importMoney, parseBackup, parseCsv, parseEvents, parseMoney, parseTime, reconcile, sampleSize, validateSteps } from './analysis';

describe('CSV files', () => {
  it('handles BOM, commas, quotes, CRLF, and quoted newlines', () => {
    expect(parseCsv('\uFEFFuser_id,event,timestamp\r\n"one, two","say ""hi""\nnext",2026-01-01\r\n')[1]).toEqual(['one, two', 'say "hi"\nnext', '2026-01-01']);
  });
  it.each(['a,a\n1,2', 'a,b\n1', 'a,b\n"no,2', 'a,b\n"yes"x,2', 'a,b\nno"pe,2', 'a,\n1,2', 'a,b\n'])('rejects malformed input %s', input => expect(() => parseCsv(input)).toThrow());
  it('reports row and expected header', () => {
    expect(() => parseEvents('user_id,event,timestamp\nu,visit,31/10/2026')).toThrow('Line 2: timestamp');
    expect(() => parseEvents('user,event,timestamp\nu,visit,2026-01-01')).toThrow('user_id');
    expect(() => parseEvents('user_id,event,timestamp\n,visit,2026-01-01')).toThrow('Line 2');
  });
  it('accepts UTC dates, SQL UTC, and zoned ISO timestamps', () => {
    expect(parseTime('2026-10-31')).toBe(Date.UTC(2026, 9, 31));
    expect(parseTime('2026-10-31 12:34:56')).toBe(Date.UTC(2026, 9, 31, 12, 34, 56));
    expect(parseTime('2026-11-01T01:00:00+02:00')).toBe(Date.UTC(2026, 9, 31, 23));
  });
  it.each(['2026-02-30', '2026-13-01', '2026-10-31T25:00:00Z', '2026-10-31T12:65:00Z', '10/11/2026', '2026-10-31T12:00:00+25:00'])('rejects invalid or ambiguous time %s', value => expect(() => parseTime(value)).toThrow());
});
describe('ordered user cohorts', () => {
  const rows = parseEvents('user_id,event,timestamp\na,buy,2026-02-01\na,visit,2026-01-31\na,visit,2026-01-31\nb,buy,2026-01-01\nb,visit,2026-01-02\nc,visit,2026-01-03\nc,buy,2026-01-03\nd,other,2026-01-01');
  it('sorts events, deduplicates users, excludes reversed steps, lets a later row satisfy a tied step, and attributes later completion to entry', () => {
    const result = funnel(rows, ['visit', 'buy'], 'month');
    expect(result.totals).toEqual([3, 2]); expect(result.periods).toEqual([['2026-01', [3, 2]]]);
    expect(funnel(rows, ['visit', 'buy'], 'day').periods).toHaveLength(3);
  });
  it('requires distinct, bounded steps', () => { expect(() => validateSteps(['visit', 'visit'])).toThrow(); expect(() => validateSteps(['visit'])).toThrow(); });
});
describe('exact payment comparison', () => {
  const mapping = { id: 'charge_id', amount: 'gross', currency: 'currency' };
  it('maps Stripe balance columns and preserves exact large decimal amounts', () => {
    const rows = parseMoney('charge_id,gross,currency,description\nch_one,9007199254740993.01,usd,"a, b"', mapping);
    expect(rows[0]).toEqual({ id: 'ch_one', amount: '9007199254740993.01', currency: 'USD', row: 2 });
    expect(decimal('0001.2000')).toBe('1.2'); expect(decimal('-0.00')).toBe('0');
  });
  it.each(['1,000', '$12', '1e3', 'NaN', '1.123456789'])('rejects nondecimal amounts %s', value => expect(() => decimal(value)).toThrow());
  it('reports mismatch, repeated rows, missing payment, and missing order from net totals', () => {
    const p = parseMoney('charge_id,gross,currency\na,1.00,usd\nb,2,eur\nc,3,usd\nc,3,usd\ne,5,usd', mapping);
    const o = parseMoney('charge_id,gross,currency\na,1,USD\nb,2,usd\nc,3,usd\nd,4,usd', mapping);
    const result = reconcile(p, o);
    expect(result.matched).toBe(1); expect(result.discrepancies.map(row => `${row.type}:${row.id}`)).toEqual(['mismatch:b', 'mismatch:c', 'duplicate:c', 'missing order:e', 'missing payment:d']);
    expect(result.discrepancies[1]).toMatchObject({ payment: '6 USD (2 rows)', order: '3 USD', paymentNet: '6', orderNet: '3', currency: 'USD' });
    expect(result.discrepancies[2].rows).toContain('payments: 4, 5');
  });
  it('nets a charge plus a refund and split payments against one order', () => {
    const p = parseMoney('id,Amount,Currency\nch_1,100.00,usd\nch_1,-30.25,usd\nch_2,10,eur\nch_2,15.5,eur', { id: 'id', amount: 'Amount', currency: 'Currency' });
    const o = parseMoney('id,Amount,Currency\nch_1,69.75,usd\nch_2,25.5,eur', { id: 'id', amount: 'Amount', currency: 'Currency' });
    expect(reconcile(p, o)).toEqual({ matched: 2, discrepancies: [] });
    expect(reconcile(p, parseMoney('id,Amount,Currency\nch_1,70,usd\nch_2,25.5,eur', { id: 'id', amount: 'Amount', currency: 'Currency' })).discrepancies.map(row => row.id)).toEqual(['ch_1']);
  });
  it('sums amounts exactly beyond floating-point range', () => {
    const rows = (amounts: string[]) => parseMoney(`id,Amount,Currency\n${amounts.map(amount => `x,${amount},usd`).join('\n')}`, { id: 'id', amount: 'Amount', currency: 'Currency' });
    expect(reconcile(rows(['9007199254740993.01', '0.1', '0.2']), rows(['9007199254740993.31'])).matched).toBe(1);
    expect(reconcile(rows(['0.1', '0.2']), rows(['0.3'])).matched).toBe(1);
  });
  it('lists only exact repeats as duplicates, using the date when a date column is mapped', () => {
    const mapped = { id: 'id', amount: 'Amount', currency: 'Currency', date: 'Created' };
    const p = parseMoney('id,Amount,Currency,Created\na,5,usd,2026-01-01\na,5,usd,2026-01-01\nb,5,usd,2026-01-01\nb,5,usd,2026-01-02', mapped);
    const result = reconcile(p, parseMoney('id,Amount,Currency\na,10,usd\nb,10,usd', { id: 'id', amount: 'Amount', currency: 'Currency' }));
    expect(result.matched).toBe(2); expect(result.discrepancies.map(row => `${row.type}:${row.id}`)).toEqual(['duplicate:a']);
    expect(result.discrepancies[0].payment).toBe('5 USD on 2026-01-01 in 2 identical rows');
  });
  it('matches IDs ignoring case and spacing by default, and exactly on request', () => {
    const p = parseMoney('id,Amount,Currency\n ch_ABC ,5,usd', { id: 'id', amount: 'Amount', currency: 'Currency' });
    const o = parseMoney('id,Amount,Currency\nCH_abc,5,usd', { id: 'id', amount: 'Amount', currency: 'Currency' });
    expect(reconcile(p, o).matched).toBe(1); expect(p[0].id).toBe('ch_ABC');
    expect(reconcile(p, o, { ignoreIdCase: false }).discrepancies.map(row => row.type)).toEqual(['missing order', 'missing payment']);
  });
  it('treats the currency column as optional and uses a default currency', () => {
    const csv = 'id,Amount\na,5\nb,6';
    expect(parseMoney(csv, { id: 'id', amount: 'Amount', currency: '' }, 'eur').map(row => row.currency)).toEqual(['EUR', 'EUR']);
    expect(() => parseMoney(csv, { id: 'id', amount: 'Amount', currency: '' })).toThrow('default currency');
    expect(() => parseMoney(csv, { id: 'id', amount: 'Amount', currency: '' }, 'EU')).toThrow('three letters');
    expect(parseMoney('id,Amount,Currency\na,5,\nb,6,usd', { id: 'id', amount: 'Amount', currency: 'Currency' }, 'gbp').map(row => row.currency)).toEqual(['GBP', 'USD']);
  });
  it('rejects absent, ambiguous, invalid columns', () => {
    expect(() => parseMoney('id,Amount,Currency\na,12,usd', mapping)).toThrow('charge_id');
    expect(() => parseMoney('charge_id,gross,currency\na,12,US', mapping)).toThrow('Line 2');
    expect(() => parseMoney('charge_id,gross,currency\na,12,USD', { ...mapping, currency: 'gross' })).toThrow('different columns');
  });
  it('exports quoted CSV, neutralizes spreadsheet formulas in text, and keeps negative numbers numeric', () => {
    const csv = discrepancyCsv([{ type: 'missing order', id: '=1+1', payment: '-5 USD', order: '', rows: 'payments: 2, 3', currency: 'USD', paymentNet: '-5.25', orderNet: '' }]);
    expect(parseCsv(csv)[1]).toEqual(['missing order', "'=1+1", "'-5 USD", '', 'payments: 2, 3', 'USD', '-5.25', '']);
    expect(parseCsv(discrepancyCsv([{ type: 'x', id: '-12', payment: '+3', order: '@a', rows: '' }]))[1].slice(1, 4)).toEqual(['-12', "'+3", "'@a"]);
  });
});
describe('statistics', () => {
  it('matches an independent two-proportion reference', () => {
    const result = experiment([1000, 100, 1000, 150]);
    expect(result.z).toBeCloseTo(3.380617, 5); expect(result.p).toBeCloseTo(0.000723, 5);
    expect(result.low).toBeCloseTo(0.021094, 5); expect(result.high).toBeCloseTo(0.078906, 5); expect(result.reliable).toBe(true);
  });
  it('is symmetric and marks sparse/degenerate groups unreliable', () => {
    expect(experiment([100, 20, 100, 20]).p).toBeCloseTo(1, 6);
    expect(experiment([100, 0, 100, 0]).reliable).toBe(false);
    expect(experiment([1000, 150, 1000, 100]).z).toBeCloseTo(-experiment([1000, 100, 1000, 150]).z);
  });
  it.each([[0, 0, 100, 20], [100, 101, 100, 20], [1.5, 1, 100, 20], [Infinity, 1, 100, 20]])('rejects invalid counts %s', (...values) => expect(() => experiment(values)).toThrow());
  it('calculates equal-arm size at 80% power and 5% alpha', () => { expect(sampleSize(10, 2)).toBe(3841); expect(sampleSize(10, 1)).toBeGreaterThan(sampleSize(10, 2)); expect(() => sampleSize(99, 2)).toThrow(); expect(() => sampleSize(0, 2)).toThrow(); });
});
describe('portable workspace', () => {
  it('round trips a versioned workspace and strips unknown fields', () => {
    const data = { ...emptyWorkspace(), events: [{ user: 'one', event: 'visit', time: 0 }], extra: 'ignored' };
    expect(parseBackup(JSON.stringify(data))).toEqual({ ...emptyWorkspace(), events: data.events });
  });
  it.each(['{', '{"version":2}', JSON.stringify({ ...emptyWorkspace(), events: [{ user: 'u', event: 'e', time: 1e30 }] }), JSON.stringify({ ...emptyWorkspace(), experiment: [1, 5, 1, 0] }), JSON.stringify({ ...emptyWorkspace(), payments: [{ id: 'a', amount: '1.00', currency: 'USD', row: 2 }] })])('rejects invalid backup %s', input => expect(() => parseBackup(input)).toThrow());
});
describe('timestamp formats', () => {
  it.each([
    ['2026-10-31T12:34:56.1Z', Date.UTC(2026, 9, 31, 12, 34, 56, 100)],
    ['2026-10-31 12:34:56.123456789', Date.UTC(2026, 9, 31, 12, 34, 56, 123)],
    ['2026-10-31T12:34:56+00', Date.UTC(2026, 9, 31, 12, 34, 56)],
    ['2026-10-31T12:34:56+0200', Date.UTC(2026, 9, 31, 10, 34, 56)],
    ['2026-10-31T12:34:56-02:30', Date.UTC(2026, 9, 31, 15, 4, 56)],
    ['2026-10-31T10:00', Date.UTC(2026, 9, 31, 10)],
    ['2026-10-31 10:00+02', Date.UTC(2026, 9, 31, 8)],
    ['1760000000', 1760000000000],
    ['1760000000123', 1760000000123],
  ])('accepts %s', (value, expected) => expect(parseTime(value)).toBe(expected));
  it('rejects an offset with minutes above 59', () => expect(() => parseTime('2026-10-31T10:00:00+0260')).toThrow());
  it.each(['01/02/2024', '2024-01-02T10', '2026-10-31T10:00:00.', '2026-10-31T10:00:00.1234567890', '176000000', '17600000001', '2026-10-31T10:00+2'])('rejects %s and names the accepted formats', value => expect(() => parseTime(value)).toThrow(/epoch/));
});
describe('same-timestamp steps', () => {
  const events = (csv: string) => parseEvents(`user_id,event,timestamp\n${csv}`);
  it('orders steps that share a timestamp by file row', () => {
    const rows = events('a,visit,2026-01-01\na,signup,2026-01-01\na,purchase,2026-01-01\nb,signup,2026-01-01\nb,visit,2026-01-01\nc,visit,2026-01-01 10:00:00\nc,signup,2026-01-01 10:00:00');
    expect(funnel(rows, ['visit', 'signup', 'purchase'], 'day').totals).toEqual([3, 2, 1]);
  });
  it('flags files whose timestamps are all dates', () => {
    expect(hasDayResolution(events('a,visit,2026-01-01\na,buy,2026-01-02'))).toBe(true);
    expect(hasDayResolution(events('a,visit,2026-01-01\na,buy,2026-01-02 00:00:01'))).toBe(false);
    expect(hasDayResolution([])).toBe(false);
  });
});
describe('partial imports', () => {
  it('skips bad rows, keeps the rest, and counts them', () => {
    const csv = ['user_id,event,timestamp', 'a,visit,2026-01-01', '', 'b,visit,31/10/2026', '"c","multi', 'line",2026-01-02', 'd,,2026-01-03', 'e,visit,2026-01-04', 'f,visit', 'g,visit,2026-01-05'].join('\r\n');
    const { rows, report } = importEvents(csv);
    expect(rows.map(row => row.user)).toEqual(['a', 'c', 'e', 'g']);
    expect(report).toMatchObject({ imported: 4, skipped: 3 });
    expect(report.reasons.map(reason => reason.split(':')[0])).toEqual(['Line 4', 'Line 7', 'Line 9']);
  });
  it('lists the first reasons with physical line numbers and the accepted formats once', () => {
    const csv = ['user_id,event,timestamp', 'a,visit,2026-01-01', 'b,visit,2026-01-02', 'c,visit,2026-01-03', '', 'd,visit,01/02/2024', 'e,visit,2026-01-04', 'f,visit,nope', 'g,visit,2026-01-05', 'h,visit,2026-01-06'].join('\n');
    const { report } = importEvents(csv);
    expect(report).toMatchObject({ imported: 6, skipped: 2 });
    expect(report.reasons.map(reason => reason.split(':')[0])).toEqual(['Line 6', 'Line 8']);
    const text = describeImport(report);
    expect(text).toContain('Imported 6 rows, skipped 2.'); expect(text).toContain('Line 6: timestamp "01/02/2024"'); expect(text.match(/Accepted timestamps/g)).toHaveLength(1);
  });
  it('counts lines inside quoted fields and across CR line endings', () => {
    const { report } = importEvents('user_id,event,timestamp\r"a\rb",visit,2026-01-01\ru,visit,bad\ru2,visit,2026-01-02\ru3,visit,2026-01-03');
    expect(report.reasons).toEqual([expect.stringMatching(/^Line 4: timestamp/)]);
  });
  it('rejects the file when none or more than half of the rows are valid', () => {
    expect(() => importEvents('user_id,event,timestamp\na,visit,x\nb,visit,y')).toThrow(/No valid rows[\s\S]*Line 2: timestamp[\s\S]*Line 3: timestamp/);
    expect(() => importEvents('user_id,event,timestamp\na,visit,2026-01-01\nb,visit,y\nc,visit,y')).toThrow('More than half');
    expect(importEvents('user_id,event,timestamp\na,visit,2026-01-01\nb,visit,y').report.skipped).toBe(1);
  });
  it('skips a record with a stray quote instead of rejecting the file', () => {
    const { rows, report } = importEvents('user_id,event,timestamp\na,5" pipe,2026-01-01\nb,visit,2026-01-02\nc,visit,2026-01-03');
    expect(rows).toHaveLength(2); expect(report.reasons[0]).toContain('Line 2: quote inside an unquoted field');
  });
  it('skips bad payment rows and reports amount and column problems', () => {
    const mapping = { id: 'id', amount: 'Amount', currency: 'Currency' };
    const { rows, report } = importMoney('id,Amount,Currency\na,1.5,usd\nb,$4,usd\nc,2,US\nd,3,usd\ne,4,eur', { mapping });
    expect(rows.map(row => [row.id, row.row])).toEqual([['a', 2], ['d', 5], ['e', 6]]);
    expect(report.reasons).toEqual([expect.stringContaining('Line 3: amount'), expect.stringContaining('Line 4: expected a three-letter currency code')]);
  });
});
describe('delimiters', () => {
  it.each([[';'], ['\t'], [',']])('detects %j from the header line', (delimiter) => {
    const csv = ['user_id', 'event', 'timestamp'].join(delimiter) + `\n"a${delimiter}1"${delimiter}visit${delimiter}2026-01-01`;
    expect(parseCsv(csv)[1]).toEqual([`a${delimiter}1`, 'visit', '2026-01-01']);
    expect(parseEvents(csv)).toHaveLength(1);
  });
  it('ignores delimiters inside quoted headers and falls back to comma', () => {
    expect(detectDelimiter('"a;b";"c;d"\n1;2')).toBe(';'); expect(detectDelimiter('"a;b","c"\n1,2')).toBe(',');
    expect(detectDelimiter('single\nvalue')).toBe(','); expect(detectDelimiter('\n\na;b')).toBe(';');
  });
  it('imports semicolon payment files and reports the detected delimiter', () => {
    const { rows, report } = importMoney('id;Amount;Currency\na;5.25;usd', { mapping: { id: 'id', amount: 'Amount', currency: 'Currency' } });
    expect(rows).toEqual([{ id: 'a', amount: '5.25', currency: 'USD', row: 2 }]); expect(describeImport(report)).toContain('semicolon-delimited');
  });
});
describe('p-value text', () => {
  it('prints a floor instead of 0.0000', () => {
    expect(formatP(0.00001)).toBe('p < 0.0001'); expect(formatP(experiment([100000, 1000, 100000, 1500]).p)).toBe('p < 0.0001');
    expect(formatP(0.0001)).toBe('p = 0.0001'); expect(formatP(0.04321)).toBe('p = 0.0432'); expect(experiment([1000, 100, 1000, 150]).p).toBeGreaterThan(0);
  });
  it('keeps p inside 0 to 1 for extreme counts', () => { const { p } = experiment([1e9, 1, 1e9, 5e8]); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); });
});
describe('backup money rows', () => {
  it('keeps an optional date and rejects a blank one', () => {
    const base = { ...emptyWorkspace(), payments: [{ id: 'a', amount: '1', currency: 'USD', row: 2, date: '2026-01-01' }] };
    expect(parseBackup(JSON.stringify(base)).payments[0].date).toBe('2026-01-01');
    expect(() => parseBackup(JSON.stringify({ ...base, payments: [{ ...base.payments[0], date: '' }] }))).toThrow();
  });
});
