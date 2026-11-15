import { ZodError } from 'zod';
import { fieldErrors, parseApiError } from '../src/lib/errors';
import { formatWhen, toIsoDateTime } from '../src/lib/format';
import { base64ByteSize } from '../src/lib/media';

test('formats recent times without a fake clock dependency', () => {
  const now = Date.parse('2026-10-20T12:00:00.000Z');
  expect(formatWhen('2026-10-20T11:59:30.000Z', now)).toBe('Just now');
  expect(formatWhen('2026-10-20T11:20:00.000Z', now)).toBe('40m');
  expect(formatWhen('2026-10-18T12:00:00.000Z', now)).toBe('2d');
});

test('turns a local date field into an ISO timestamp', () => {
  expect(toIsoDateTime('')).toBeNull();
  expect(toIsoDateTime('not-a-date')).toBeNull();
  expect(toIsoDateTime('2026-10-21T18:00:00.000Z')).toBe(
    '2026-10-21T18:00:00.000Z',
  );
});

test('reads API error envelopes', () => {
  const error = parseApiError(403, {
    error: {
      code: 'EMAIL_UNVERIFIED',
      message: 'Verify your email to continue',
    },
  });
  expect(error.code).toBe('EMAIL_UNVERIFIED');
  expect(error.message).toBe('Verify your email to continue');
});

test('maps the first zod issue for each field', () => {
  const error = new ZodError([
    { code: 'custom', path: ['body'], message: 'Required' },
    { code: 'custom', path: ['body'], message: 'Too short' },
  ]);
  expect(fieldErrors(error)).toEqual({ body: 'Required' });
});

test('counts base64 payload bytes the way the upload API checks them', () => {
  expect(base64ByteSize('YQ==')).toBe(1);
  expect(base64ByteSize('YWI=')).toBe(2);
});
