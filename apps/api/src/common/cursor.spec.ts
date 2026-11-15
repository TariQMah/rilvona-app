import { cursorFilter, decodeCursor, encodeCursor } from './cursor';

describe('cursor pagination', () => {
  it('round-trips a date and id', () => {
    const date = new Date('2026-10-18T10:15:00.000Z');
    const decoded = decodeCursor(encodeCursor(date, 'post_123'));
    expect(decoded.id).toBe('post_123');
    expect(decoded.date.toISOString()).toBe(date.toISOString());
  });

  it('rejects a malformed cursor', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow('That page cursor is invalid');
  });

  it('builds a descending keyset filter', () => {
    const date = new Date('2026-10-18T10:15:00.000Z');
    expect(cursorFilter({ date, id: 'abc' }, 'createdAt', 'desc')).toEqual({
      OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: 'abc' } }],
    });
  });
});
