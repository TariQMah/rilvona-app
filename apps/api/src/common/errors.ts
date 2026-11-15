import { HttpException } from '@nestjs/common';

export class AppError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    readonly publicMessage: string,
    readonly details?: unknown,
  ) {
    super(publicMessage, status);
  }
}

export function notFound(message = 'Not found') {
  return new AppError(404, 'NOT_FOUND', message);
}

export function forbidden(message = 'You do not have permission to do that') {
  return new AppError(403, 'FORBIDDEN', message);
}

export function unauthorized(message = 'Sign in required') {
  return new AppError(401, 'UNAUTHORIZED', message);
}

export function conflict(code: string, message: string) {
  return new AppError(409, code, message);
}
