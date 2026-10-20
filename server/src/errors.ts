export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Data tidak ditemukan') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(409, message, details);
    this.name = 'ConflictError';
  }
}
