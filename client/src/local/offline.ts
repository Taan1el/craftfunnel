import { useSyncExternalStore } from 'react';

// The pieces of the service worker API this file uses, so the logic can be tested with plain fakes.
export interface WorkerLike { state: string; postMessage(message: unknown): void; addEventListener(type: 'statechange', listener: () => void): void }
export interface RegistrationLike { waiting: WorkerLike | null; installing: WorkerLike | null; addEventListener(type: 'updatefound', listener: () => void): void }
export interface ContainerLike { controller: unknown; addEventListener(type: 'controllerchange', listener: () => void): void }

// Tracks whether a new version is installed and waiting. A worker that installs while nothing controls
// the page is the first install, not an update, so it never raises the notice.
export function createUpdateNotice(reload: () => void) {
  let waiting: WorkerLike | null = null; let reloading = false; const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    ready: () => waiting !== null,
    offer(worker: WorkerLike) { waiting = worker; emit(); },
    // Called only from the Reload button. The page reloads once, when the new worker takes control.
    apply(container: ContainerLike) {
      if (!waiting || reloading) return;
      reloading = true;
      container.addEventListener('controllerchange', reload);
      waiting.postMessage({ type: 'SKIP_WAITING' });
    },
  };
}

export function watchUpdates(registration: RegistrationLike, container: ContainerLike, offer: (worker: WorkerLike) => void): void {
  const check = () => { if (container.controller && registration.waiting) offer(registration.waiting); };
  check();
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => { if (worker.state === 'installed') check(); });
  });
}

const notice = createUpdateNotice(() => window.location.reload());

export const useUpdateReady = (): boolean => useSyncExternalStore(notice.subscribe, notice.ready, () => false);
export const applyUpdate = (): void => { if ('serviceWorker' in navigator) notice.apply(navigator.serviceWorker); };

export function registerOffline(): void {
  if (import.meta.env.MODE !== 'pages' || !('serviceWorker' in navigator)) return;

  const register = () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).then((registration) => {
      watchUpdates(registration, navigator.serviceWorker, notice.offer);
    }).catch((error: unknown) => {
      console.error('Offline storage could not start.', error);
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
