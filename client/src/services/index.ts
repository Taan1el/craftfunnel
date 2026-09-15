// The one place that decides whether the app talks to the real Express API
// or the in-browser demo. Components import from here, never directly from
// ./api.js or ./demoApi.js, so the choice stays in a single spot.
import { api as realApi } from './api.js';
import { demoApi, resetDemoData as resetDemoDataImpl } from './demoApi.js';

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export const api = isDemoMode ? demoApi : realApi;

// Only meaningful in demo mode; the real API has no equivalent action a
// browser client can trigger, so the demo banner is the only caller.
export const resetDemoData = resetDemoDataImpl;
