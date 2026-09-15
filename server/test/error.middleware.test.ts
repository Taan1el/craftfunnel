import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Response } from 'express';
import { errorHandler } from '../src/middleware/error.middleware.js';
import { HttpError } from '../../shared/http-error.js';

function mockResponse() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('errorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the message of a client-facing HttpError (status < 500)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();
    const err = new HttpError(404, "Experiment 'ghost' not found");

    errorHandler(err, {} as any, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Experiment 'ghost' not found" });
  });

  it('hides the message of an unexpected error behind a generic 500', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();
    const err = new TypeError("Cannot read properties of undefined (reading 'foo')");

    errorHandler(err, {} as any, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal Server Error' });
  });

  it('hides the message of an HttpError with a 5xx status too', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();
    const err = new HttpError(503, 'Upstream database file locked at /var/data/prod.db');

    errorHandler(err, {} as any, res, () => {});

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal Server Error' });
  });

  it('always logs the full error server-side, even when the client gets a generic message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();
    const err = new Error('detailed internal failure');

    errorHandler(err, {} as any, res, () => {});

    expect(spy).toHaveBeenCalledWith('[CraftFunnel Error]:', err);
  });
});
