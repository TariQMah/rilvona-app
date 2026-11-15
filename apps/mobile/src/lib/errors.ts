import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function parseApiError(status: number, body: unknown) {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (
      body as { error?: { code?: string; message?: string; details?: unknown } }
    ).error;
    if (error?.message) {
      return new ApiError(
        status,
        error.code ?? 'HTTP_ERROR',
        error.message,
        error.details ?? null,
      );
    }
  }
  if (status === 0)
    return new ApiError(0, 'OFFLINE', 'Check your connection and try again.');
  return new ApiError(status, 'HTTP_ERROR', 'Something went wrong. Try again.');
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}

export function fieldErrors(error: ZodError) {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!map[key]) map[key] = issue.message;
  }
  return map;
}
