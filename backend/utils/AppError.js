/**
 * Error with a stable machine-readable code and an HTTP status.
 * The error middleware turns it into { success: false, code, message }.
 */
export class AppError extends Error {
  constructor(code, status, message) {
    super(message || code);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export const isAppError = (error) => error instanceof AppError;
