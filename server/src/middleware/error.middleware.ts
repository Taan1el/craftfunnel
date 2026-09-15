import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../../../shared/http-error.js';

/**
 * Always logs the full error server-side. Only sends the error's own message
 * to the client when it was raised deliberately as an HttpError with a
 * client-safe message and a 4xx status; anything else (a thrown TypeError, a
 * database constraint failure, etc.) gets a generic message so internals
 * such as stack traces, file paths, or SQL never reach the response body.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[CraftFunnel Error]:', err);

  if (err instanceof HttpError && err.status < 500) {
    res.status(err.status).json({ success: false, error: err.message });
    return;
  }

  const status = err instanceof HttpError ? err.status : 500;
  res.status(status).json({ success: false, error: 'Internal Server Error' });
}
