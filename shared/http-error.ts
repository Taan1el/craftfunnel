// Thrown by services to signal a specific HTTP status with a message that is
// safe to send to the client (as opposed to an unexpected error, where the
// message might contain internal detail and should not be exposed). See
// server/src/middleware/error.middleware.ts.
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
