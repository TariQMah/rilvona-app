import { extractTables, type RawTable } from './htmlTables';

/**
 * Chandigarh University publishes its holiday list and academic calendar as plain public web pages (no login).
 * These pure parsers turn those pages into dated entries. Nothing here touches the network.
 */

export const CALENDAR_PAGES = {
  holidays: 'https://www.cuchd.in/academics/list-of-holidays.php',
  /** University Institute of Computing (BCA / MCA): odd and even semester in one page. */
  UIC: ['https://www.cuchd.in/academics/academic-calendar-uic.php'],
  /** Every other institute: separate odd and even pages. */
  GENERAL: [
    'https://www.cuchd.in/academics/academic-calendar-odd.php',
    'https://www.cuchd.in/academics/academic-calendar.php',
  ],
} as const;

export type CalendarVariant = 'UIC' | 'GENERAL';

export type CalendarHoliday = { date: string; name: string };

export type EventKind =
  | 'break'
  | 'exam'
  | 'teaching-end'
  | 'term-start'
  | 'term-end'
  | 'event';

export type CalendarEvent = {
  /** First day, `YYYY-MM-DD`. */
  date: string;
  /** Last day for ranges such as "09.11.2026 to 11.11.2026". */
  endDate?: string;
  title: string;
  kind: EventKind;
};

export type AcademicCalendar = {
  variant: CalendarVariant;
  holidays: CalendarHoliday[];
  events: CalendarEvent[];
  fetchedAt: string;
};

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (y: number, m: number, d: number) =>
  `${y}-${pad(m)}-${pad(d)}`;

const weekdayOf = (y: number, month1: number, d: number) =>
  new Date(Date.UTC(y, month1 - 1, d)).getUTCDay();

/**
 * "Holi | 04 March | Wednesday": the list has no year, so pick the nearby year in which that date really is a
 * Wednesday. Falls back to the current year when the weekday is missing or matches nothing.
 */
export function parseHolidays(
  html: string,
  now: Date = new Date(),
): CalendarHoliday[] {
  const out: CalendarHoliday[] = [];
  const year = now.getFullYear();
  for (const table of extractTables(html)) {
    for (const row of [table.headers, ...table.rows]) {
      let month = -1;
      let day = 0;
      let weekday = -1;
      let name = '';
      for (const cell of row) {
        const text = cell.trim();
        const date = /^(\d{1,2})\s+([A-Za-z]+)$/.exec(text);
        const m = date ? MONTHS.indexOf(date[2]?.toLowerCase() ?? '') : -1;
        if (date && m >= 0) {
          month = m + 1;
          day = Number(date[1]);
        } else if (WEEKDAYS.includes(text.toLowerCase())) {
          weekday = WEEKDAYS.indexOf(text.toLowerCase());
        } else if (/[A-Za-z]{3}/.test(text) && text.length > name.length) {
          name = text;
        }
      }
      if (month < 0 || !day || !name) continue;
      const candidates = [year, year + 1, year - 1];
      const chosen =
        weekday >= 0
          ? candidates.find(y => weekdayOf(y, month, day) === weekday) ?? year
          : year;
      out.push({ date: isoDate(chosen, month, day), name });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const DATE_RANGE =
  /\[?\s*(\d{2})\.(\d{2})\.(\d{4})\s*(?:to|-|–|—)\s*(\d{2})\.(\d{2})\.(\d{4})\s*\]?/i;

/** Drops "[All Programs of UIC]", "[09.11.2026 to 11.11.2026]" and trailing asterisks from an activity. */
export function cleanActivity(text: string): string {
  return (
    text
      .replace(/\([^)]*programs?[^)]*\)/gi, ' ')
      // Two programme groups share one calendar; keep which one a row is for.
      .replace(/\[[^\]]*except\s+UID[^\]]*\]/gi, ' (other programs) ')
      .replace(/\[[^\]]*\bof\s+UID[^\]]*\]/gi, ' (UID programs) ')
      .replace(/\[[^\]]*(?:programs?|\d{2}\.\d{2}\.\d{4})[^\]]*\]/gi, ' ')
      .replace(/\s*\*+\s*$/g, '')
      .replace(/\s+,/g, ',')
      .replace(/\s+/g, ' ')
      .replace(/[\s,-]+$/g, '')
      .trim()
  );
}

export function classifyActivity(text: string): EventKind {
  const t = text.toLowerCase();
  if (/diwali break|break for students|holiday/.test(t)) return 'break';
  if (/last teaching day/.test(t)) return 'teaching-end';
  if (/registration|orientation|announcement|party|award/.test(t))
    return 'event';
  if (/^start of (?:the )?(?:odd |even )?semester/.test(t)) return 'term-start';
  if (/^end of (?:the )?(?:odd |even )?semester/.test(t)) return 'term-end';
  if (/exam|test|evaluation/.test(t)) return 'exam';
  return 'event';
}

/** Rows of "01-07-2026 | Wed | Activity [range]" from every table on a calendar page. */
export function parseCalendarEvents(html: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const rowsOf = (table: RawTable) => [table.headers, ...table.rows];
  for (const table of extractTables(html)) {
    for (const row of rowsOf(table)) {
      const first = /^(\d{2})-(\d{2})-(\d{4})$/.exec((row[0] ?? '').trim());
      const raw = (row[row.length - 1] ?? '').trim();
      if (!first || !raw || /^\d{2}-\d{2}-\d{4}$/.test(raw)) continue;
      const date = isoDate(
        Number(first[3]),
        Number(first[2]),
        Number(first[1]),
      );
      const range = DATE_RANGE.exec(raw);
      const endDate = range
        ? isoDate(Number(range[6]), Number(range[5]), Number(range[4]))
        : undefined;
      const title = cleanActivity(raw);
      if (!title) continue;
      events.push({
        date,
        endDate: endDate && endDate > date ? endDate : undefined,
        title,
        kind: classifyActivity(title),
      });
    }
  }
  return events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );
}

/** Every `YYYY-MM-DD` from `start` to `end` inclusive, capped so a bad range cannot run away. */
export function expandRange(start: string, end: string, cap = 62): string[] {
  const out: string[] = [];
  const [y, m, d] = start.split('-').map(Number);
  if (!y || !m || !d) return out;
  const last = end.localeCompare(start) < 0 ? start : end;
  for (let i = 0; i < cap; i += 1) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const key = isoDate(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
    );
    if (key > last) break;
    out.push(key);
  }
  return out;
}

/** Days on which classes will not run: gazetted holidays and the university's own breaks. */
export function nonTeachingDates(calendar: AcademicCalendar): Set<string> {
  const set = new Set<string>(calendar.holidays.map(h => h.date));
  for (const event of calendar.events)
    if (event.kind === 'break')
      for (const day of expandRange(event.date, event.endDate ?? event.date))
        set.add(day);
  return set;
}

const todayIso = (now: Date) =>
  isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());

/** The first "Last Teaching Day" that has not passed (the earliest one when several programmes are listed). */
export function lastTeachingDay(
  calendar: AcademicCalendar,
  now: Date = new Date(),
): string | null {
  const today = todayIso(now);
  return (
    calendar.events.find(e => e.kind === 'teaching-end' && e.date >= today)
      ?.date ?? null
  );
}

export function upcomingHolidays(
  calendar: AcademicCalendar,
  now: Date = new Date(),
  limit = 5,
): CalendarHoliday[] {
  const today = todayIso(now);
  return calendar.holidays.filter(h => h.date >= today).slice(0, limit);
}

/** Whole days from today to an ISO date (0 for today). */
export function daysUntilIso(iso: string, now: Date = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(
    (Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - start) / 864e5,
  );
}

/** UIC (BCA / MCA) students follow a different calendar from the other institutes. */
export function defaultCalendarVariant(info: {
  program?: string | null;
  studentUid?: string | null;
  section?: string | null;
}): CalendarVariant {
  const text = `${info.program ?? ''} ${info.studentUid ?? ''} ${
    info.section ?? ''
  }`;
  return /\b(?:BCA|MCA)\b|\d{2}(?:MCA|MCI|MAM|BCA)|computing|\bUIC\b/i.test(
    text,
  )
    ? 'UIC'
    : 'GENERAL';
}

export type DayMark = 'holiday' | 'break' | 'exam' | 'event';

const MARK_RANK: Record<DayMark, number> = {
  holiday: 3,
  break: 2,
  exam: 1,
  event: 0,
};

const markOf = (kind: EventKind): DayMark =>
  kind === 'break' ? 'break' : kind === 'exam' ? 'exam' : 'event';

/** What each calendar day is, for colouring a month grid. When several things share a day the most important wins. */
export function calendarDayMarks(
  calendar: AcademicCalendar,
): Map<string, DayMark> {
  const marks = new Map<string, DayMark>();
  const put = (day: string, mark: DayMark) => {
    const current = marks.get(day);
    if (!current || MARK_RANK[mark] > MARK_RANK[current]) marks.set(day, mark);
  };
  for (const holiday of calendar.holidays) put(holiday.date, 'holiday');
  for (const event of calendar.events)
    for (const day of expandRange(event.date, event.endDate ?? event.date))
      put(day, markOf(event.kind));
  return marks;
}

export type CalendarItem = {
  date: string;
  endDate?: string;
  title: string;
  mark: DayMark;
};

/** Holidays and events that touch the given month (`month1` is 1 to 12), in date order. */
export function itemsInMonth(
  calendar: AcademicCalendar,
  year: number,
  month1: number,
): CalendarItem[] {
  const first = isoDate(year, month1, 1);
  const last = isoDate(year, month1, 31);
  const items: CalendarItem[] = [
    ...calendar.holidays.map<CalendarItem>(h => ({
      date: h.date,
      title: h.name,
      mark: 'holiday',
    })),
    ...calendar.events.map<CalendarItem>(e => ({
      date: e.date,
      endDate: e.endDate,
      title: e.title,
      mark: markOf(e.kind),
    })),
  ];
  return items
    .filter(i => i.date <= last && (i.endDate ?? i.date) >= first)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    );
}
