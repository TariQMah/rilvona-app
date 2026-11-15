import { AppError } from './errors';

export function encodeCursor(date: Date, id: string) {
  return Buffer.from(`${date.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string) {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const separator = decoded.lastIndexOf('|');
    const iso = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    const date = new Date(iso);
    if (!iso || !id || Number.isNaN(date.getTime())) {
      throw new Error('invalid');
    }
    return { date, id };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'That page cursor is invalid');
  }
}

export function cursorFilter(
  cursor: { date: Date; id: string } | undefined,
  field: 'createdAt' | 'startsAt',
  direction: 'asc' | 'desc',
) {
  if (!cursor) return {};
  const compare = direction === 'desc' ? 'lt' : 'gt';
  return {
    OR: [{ [field]: { [compare]: cursor.date } }, { [field]: cursor.date, id: { [compare]: cursor.id } }],
  };
}

export function pageResult<T extends { id: string }>(
  rows: T[],
  limit: number,
  dateOf: (row: T) => Date,
) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    data: items,
    meta: {
      hasMore,
      nextCursor: hasMore && last ? encodeCursor(dateOf(last), last.id) : null,
    },
  };
}
