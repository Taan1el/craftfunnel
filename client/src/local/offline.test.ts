import { describe, expect, it, vi } from 'vitest';
import { createUpdateNotice, watchUpdates, type ContainerLike, type RegistrationLike, type WorkerLike } from './offline';

class FakeWorker implements WorkerLike {
  state = 'installing'; posted: unknown[] = []; private listeners: Array<() => void> = [];
  postMessage(message: unknown) { this.posted.push(message); }
  addEventListener(_type: 'statechange', listener: () => void) { this.listeners.push(listener); }
  become(state: string) { this.state = state; this.listeners.forEach(listener => listener()); }
}
class FakeRegistration implements RegistrationLike {
  waiting: WorkerLike | null = null; installing: WorkerLike | null = null; private listeners: Array<() => void> = [];
  addEventListener(_type: 'updatefound', listener: () => void) { this.listeners.push(listener); }
  found(worker: FakeWorker) { this.installing = worker; this.listeners.forEach(listener => listener()); }
}
class FakeContainer implements ContainerLike {
  controller: unknown = {}; private listeners: Array<() => void> = [];
  addEventListener(_type: 'controllerchange', listener: () => void) { this.listeners.push(listener); }
  change() { this.listeners.forEach(listener => listener()); }
}

describe('update notice', () => {
  it('stays hidden for the first install, which has no controlling worker', () => {
    const container = new FakeContainer(); container.controller = null;
    const registration = new FakeRegistration(); const offer = vi.fn();
    watchUpdates(registration, container, offer);
    const worker = new FakeWorker(); registration.found(worker); worker.become('installed'); worker.become('activated');
    expect(offer).not.toHaveBeenCalled();
  });
  it('is offered when a new worker finishes installing under a controlled page', () => {
    const container = new FakeContainer(); const registration = new FakeRegistration(); const offer = vi.fn();
    watchUpdates(registration, container, offer);
    const worker = new FakeWorker(); registration.found(worker); worker.become('installing'); expect(offer).not.toHaveBeenCalled();
    registration.waiting = worker; worker.become('installed'); expect(offer).toHaveBeenCalledWith(worker);
  });
  it('is offered at load when an update is already waiting', () => {
    const registration = new FakeRegistration(); const worker = new FakeWorker(); registration.waiting = worker; const offer = vi.fn();
    watchUpdates(registration, new FakeContainer(), offer); expect(offer).toHaveBeenCalledWith(worker);
  });
  it('tracks readiness for subscribers and never reloads before the button is pressed', () => {
    const reload = vi.fn(); const notice = createUpdateNotice(reload); const changed = vi.fn(); const container = new FakeContainer();
    const stop = notice.subscribe(changed); expect(notice.ready()).toBe(false);
    const worker = new FakeWorker(); notice.offer(worker); expect(notice.ready()).toBe(true); expect(changed).toHaveBeenCalledTimes(1);
    container.change(); expect(reload).not.toHaveBeenCalled(); expect(worker.posted).toEqual([]);
    stop(); notice.offer(new FakeWorker()); expect(changed).toHaveBeenCalledTimes(1);
  });
  it('asks the waiting worker to activate and reloads once when it takes control', () => {
    const reload = vi.fn(); const notice = createUpdateNotice(reload); const container = new FakeContainer(); const worker = new FakeWorker();
    notice.apply(container); expect(reload).not.toHaveBeenCalled();
    notice.offer(worker); notice.apply(container); notice.apply(container);
    expect(worker.posted).toEqual([{ type: 'SKIP_WAITING' }]);
    container.change(); expect(reload).toHaveBeenCalledTimes(1);
  });
});
