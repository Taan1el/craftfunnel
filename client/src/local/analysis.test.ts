import { describe, expect, it } from 'vitest';
import { decimal, discrepancyCsv, emptyWorkspace, experiment, funnel, parseBackup, parseCsv, parseEvents, parseMoney, parseTime, reconcile, sampleSize, validateSteps } from './analysis';

describe('CSV files', () => {
  it('handles BOM, commas, quotes, CRLF, and quoted newlines', () => {
    expect(parseCsv('\uFEFFuser_id,event,timestamp\r\n"one, two","say ""hi""\nnext",2026-01-01\r\n')[1]).toEqual(['one, two', 'say "hi"\nnext', '2026-01-01']);
  });
  it.each(['a,a\n1,2', 'a,b\n1', 'a,b\n"no,2', 'a,b\n"yes"x,2', 'a,b\nno"pe,2', 'a,\n1,2', 'a,b\n'])('rejects malformed input %s', input => expect(() => parseCsv(input)).toThrow());
  it('reports row and expected header', () => {
    expect(() => parseEvents('user_id,event,timestamp\nu,visit,31/10/2026')).toThrow('Row 2, timestamp');
    expect(() => parseEvents('user,event,timestamp\nu,visit,2026-01-01')).toThrow('user_id');
    expect(() => parseEvents('user_id,event,timestamp\n,visit,2026-01-01')).toThrow('Row 2');
  });
  it('accepts UTC dates, SQL UTC, and zoned ISO timestamps', () => {
    expect(parseTime('2026-10-31')).toBe(Date.UTC(2026, 9, 31));
    expect(parseTime('2026-10-31 12:34:56')).toBe(Date.UTC(2026, 9, 31, 12, 34, 56));
    expect(parseTime('2026-11-01T01:00:00+02:00')).toBe(Date.UTC(2026, 9, 31, 23));
  });
  it.each(['2026-02-30', '2026-13-01', '2026-10-31T25:00:00Z', '2026-10-31T12:65:00Z', '10/11/2026', '1760000000', '2026-10-31T12:00:00+25:00'])('rejects invalid or ambiguous time %s', value => expect(() => parseTime(value)).toThrow());
});
describe('ordered user cohorts', () => {
  const rows = parseEvents('user_id,event,timestamp\na,buy,2026-02-01\na,visit,2026-01-31\na,visit,2026-01-31\nb,buy,2026-01-01\nb,visit,2026-01-02\nc,visit,2026-01-03\nc,buy,2026-01-03\nd,other,2026-01-01');
  it('sorts events, deduplicates users, excludes reversed and tied steps, and attributes later completion to entry', () => {
    const result = funnel(rows, ['visit', 'buy'], 'month');
    expect(result.totals).toEqual([3, 1]); expect(result.periods).toEqual([['2026-01', [3, 1]]]);
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
  it('reports duplicate, mismatch, missing payment, and missing order without double-matching', () => {
    const p = parseMoney('charge_id,gross,currency\na,1.00,usd\nb,2,eur\nc,3,usd\nc,3,usd\ne,5,usd', mapping);
    const o = parseMoney('charge_id,gross,currency\na,1,USD\nb,2,usd\nc,3,usd\nd,4,usd', mapping);
    const result = reconcile(p, o);
    expect(result.matched).toBe(1); expect(result.discrepancies.map(row => row.type)).toEqual(['mismatch', 'duplicate', 'missing order', 'missing payment']);
    expect(result.discrepancies[1].rows).toContain('4, 5');
  });
  it('rejects absent, ambiguous, invalid columns', () => {
    expect(() => parseMoney('id,Amount,Currency\na,12,usd', mapping)).toThrow('charge_id');
    expect(() => parseMoney('charge_id,gross,currency\na,12,US', mapping)).toThrow('Row 2');
    expect(() => parseMoney('charge_id,gross,currency\na,12,USD', { ...mapping, currency: 'gross' })).toThrow('different columns');
  });
  it('exports quoted CSV and neutralizes spreadsheet formulas', () => {
    const csv = discrepancyCsv([{ type: 'missing order', id: '=1+1', payment: '1 USD', order: '', rows: 'payments: 2, 3' }]);
    expect(parseCsv(csv)[1]).toEqual(['missing order', "'=1+1", '1 USD', '', 'payments: 2, 3']);
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
