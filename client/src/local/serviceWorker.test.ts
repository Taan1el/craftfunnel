// @vitest-environment node
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { serviceWorker } from '../../localBuild';

const ORIGIN = 'https://example.test';
const BASE = '/craftfunnel/';
type Handler = (event: Record<string, unknown>) => void;

// Runs the generated worker source against small fakes of the worker globals.
function load(files = [BASE, `${BASE}index.html`, `${BASE}assets/app.js`], version = 'new') {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const fetched: Array<{ url: string; init?: RequestInit }> = [];
  const store = (name: string) => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name)!; };
  const key = (input: string | Request) => { const url = new URL(typeof input === 'string' ? input : input.url, ORIGIN); return url.origin + url.pathname; };
  const state = { online: true, status: 200, requests: [] as Request[] };
  const caches = {
    open: async (name: string) => ({
      addAll: async (requests: Request[]) => { for (const request of requests) { state.requests.push(request); store(name).set(key(request), new Response(`cached ${request.url}`)); } },
      match: async (request: string | Request) => store(name).get(key(request))?.clone(),
    }),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const self = { location: { origin: ORIGIN }, addEventListener: (type: string, handler: Handler) => { handlers[type] = handler; }, skipWaiting: vi.fn(), clients: { claim: vi.fn(async () => undefined) } };
  class ScopedRequest extends Request { constructor(input: string, init?: RequestInit) { super(new URL(input, ORIGIN).href, init); } }
  const fetchFake = vi.fn(async (input: string | Request, init?: RequestInit) => {
    fetched.push({ url: typeof input === 'string' ? input : input.url, init });
    if (!state.online) throw new TypeError('network down');
    return new Response('network page', { status: state.status });
  });
  const context = vm.createContext({ self, caches, fetch: fetchFake, Request: ScopedRequest, URL, Promise });
  vm.runInContext(serviceWorker('craftfunnel-offline-', version, BASE, files), context);
  const call = <T>(name: string, ...args: unknown[]) => (vm.runInContext(name, context) as (...input: unknown[]) => T)(...args);
  const dispatch = async (type: string, event: Record<string, unknown>) => { let pending: Promise<unknown> | undefined; await handlers[type]({ ...event, waitUntil: (promise: Promise<unknown>) => { pending = promise; }, respondWith: (promise: Promise<unknown>) => { pending = promise; } }); return pending; };
  return { self, stores, store, fetched, state, call, dispatch };
}
const get = (path: string, mode = 'no-cors', method = 'GET') => ({ url: ORIGIN + path, method, mode });

describe('offline worker', () => {
  it('names the cache from the prefix and build version', () => {
    const worker = load();
    expect(worker.call('cacheName', 'craftfunnel-offline-', 'abc123')).toBe('craftfunnel-offline-abc123');
  });
  it('picks a strategy per request', () => {
    const { call } = load();
    expect(call('strategyFor', get(BASE, 'navigate'), ORIGIN, BASE)).toBe('network-first');
    expect(call('strategyFor', get(`${BASE}index.html`, 'navigate'), ORIGIN, BASE)).toBe('network-first');
    expect(call('strategyFor', get(`${BASE}assets/app.js`), ORIGIN, BASE)).toBe('cache-first');
    expect(call('strategyFor', get(`${BASE}assets/app.js`, 'no-cors', 'POST'), ORIGIN, BASE)).toBe('ignore');
    expect(call('strategyFor', { url: 'https://other.test/craftfunnel/a.js', method: 'GET', mode: 'no-cors' }, ORIGIN, BASE)).toBe('ignore');
    expect(call('strategyFor', get('/elsewhere/a.js'), ORIGIN, BASE)).toBe('ignore');
  });
  it('precaches every file bypassing the HTTP cache and does not skip waiting on its own', async () => {
    const worker = load();
    await worker.dispatch('install', {});
    expect(worker.state.requests.map(request => new URL(request.url).pathname)).toEqual([BASE, `${BASE}index.html`, `${BASE}assets/app.js`]);
    expect(worker.state.requests.every(request => request.cache === 'reload')).toBe(true);
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
  });
  it('serves pages network-first and falls back to the cached page offline', async () => {
    const worker = load(); await worker.dispatch('install', {});
    const request = get(BASE, 'navigate');
    const online = await worker.dispatch('fetch', { request }) as Response;
    expect(await online.text()).toBe('network page'); expect(worker.fetched.at(-1)?.init).toMatchObject({ cache: 'no-cache' });
    worker.state.online = false;
    const offline = await worker.dispatch('fetch', { request }) as Response;
    expect(await offline.text()).toContain(`cached ${ORIGIN}${BASE}`);
  });
  it('serves built assets cache-first without touching the network', async () => {
    const worker = load(); await worker.dispatch('install', {});
    const before = worker.fetched.length;
    const asset = await worker.dispatch('fetch', { request: get(`${BASE}assets/app.js?v=1`) }) as Response;
    expect(await asset.text()).toContain('cached'); expect(worker.fetched.length).toBe(before);
  });
  it('uses the cached page when the server answers with an error, and lets other requests pass to the browser', async () => {
    const worker = load(); await worker.dispatch('install', {});
    worker.state.status = 503; const failed = await worker.dispatch('fetch', { request: get(BASE, 'navigate') }) as Response; expect(await failed.text()).toContain('cached');
    worker.fetched.length = 0;
    expect(await worker.dispatch('fetch', { request: get('/other', 'navigate') })).toBeUndefined();
    expect(await worker.dispatch('fetch', { request: get(`${BASE}assets/app.js`, 'no-cors', 'POST') })).toBeUndefined();
  });
  it('skips waiting only when the page asks', async () => {
    const worker = load();
    await worker.dispatch('message', { data: { type: 'SOMETHING_ELSE' } }); await worker.dispatch('message', { data: null });
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
    await worker.dispatch('message', { data: { type: 'SKIP_WAITING' } });
    expect(worker.self.skipWaiting).toHaveBeenCalledTimes(1);
  });
  it('deletes older versioned caches on activate, keeps unrelated ones, and claims clients', async () => {
    const worker = load();
    worker.store('craftfunnel-offline-old'); worker.store('craftfunnel-offline-new'); worker.store('unrelated');
    await worker.dispatch('activate', {});
    expect([...worker.stores.keys()].sort()).toEqual(['craftfunnel-offline-new', 'unrelated']); expect(worker.self.clients.claim).toHaveBeenCalled();
  });
});
