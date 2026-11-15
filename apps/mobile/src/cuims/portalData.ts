import { extractTables, textOf, type RawTable } from './htmlTables';

/**
 * Pure parsers for the three CUIMS pages the app reads. Layouts follow the public community clients
 * (cu-unofficial/uims-api, xpt1x/SnapAttendance) and the live portal markup. Nothing here touches the network.
 */

export const isPortalErrorPage = (html: string, url = ''): boolean =>
  /\/error\.html(\?|$)/i.test(url) || /Whoops,\s*Something broke/i.test(html);

/**
 * True when a page is the signed-in student dashboard rather than the login form or an error page.
 * Used to tell whether a saved portal session is still alive.
 */
export function isSignedInDashboard(html: string, url = ''): boolean {
  if (isPortalErrorPage(html, url)) return false;
  if (/name="txtLoginPassword"|name="txtUserId"/i.test(html)) return false;
  return /id="hfdfdfds_sid"/i.test(html);
}

// ---------------------------------------------------------------- attendance

/** The attendance page fills its table from a JSON call that needs two ids embedded in the page script. */
export function extractReportParams(
  html: string,
): { reportId: string; sessionId: string } | null {
  const report = /getReport\s*\(\s*['"]([^'"]+)['"]/i.exec(html)?.[1];
  let session: string | undefined;
  for (const match of html.matchAll(
    /CurrentSession\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/gi,
  )) {
    if (match[1]) {
      session = match[1];
      break;
    }
  }
  return report && session ? { reportId: report, sessionId: session } : null;
}

/**
 * `{ d: ... }` as returned by ASP.NET page methods. `d` is a JSON string for the summary report, and an object
 * `{ Result: "<json string>" }` for the per-subject report; "No Data Found" means an empty list.
 */
export function unwrapPageMethod(body: string): unknown[] | null {
  try {
    const outer = JSON.parse(body) as { d?: unknown };
    let inner: unknown = outer.d;
    if (
      typeof inner === 'object' &&
      inner !== null &&
      !Array.isArray(inner) &&
      'Result' in inner
    ) {
      inner = (inner as { Result: unknown }).Result;
      if (inner === 'No Data Found') return [];
    }
    if (typeof inner === 'string') inner = JSON.parse(inner) as unknown;
    return Array.isArray(inner) ? inner : null;
  } catch {
    return null;
  }
}

const pick = (
  item: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim() !== '')
      return String(value).trim();
  }
  return undefined;
};

/**
 * Subject-wise attendance as a table the server parser understands. Uses the eligibility counts (which include
 * duty leave), which is what the 75% rule is measured on. `keys` lists field names only, for diagnostics.
 */
export function attendanceTableFromReport(items: unknown[]): {
  table: RawTable | null;
  keys: string[];
} {
  const records = items.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null,
  );
  const keys = Array.from(
    new Set(records.flatMap(record => Object.keys(record))),
  ).slice(0, 40);
  const rows: string[][] = [];
  for (const record of records) {
    const name = pick(record, [
      'Title',
      'SubjectName',
      'CourseName',
      'Subject',
    ]);
    const delivered = pick(record, [
      'EligibilityDelivered',
      'Total_Delv',
      'TotalDelivered',
    ]);
    const attended = pick(record, [
      'EligibilityAttended',
      'Total_Attd',
      'TotalAttended',
    ]);
    if (!name || delivered === undefined || attended === undefined) continue;
    const duty =
      (Number(record.DutyLeave_N_P) || 0) +
      (Number(record.DutyLeave_Others) || 0);
    rows.push([
      name,
      pick(record, ['CourseCode', 'SubjectCode', 'Code']) ?? '',
      attended,
      delivered,
      String(duty),
    ]);
  }
  if (rows.length === 0) return { table: null, keys };
  return {
    table: {
      caption: 'Attendance',
      headers: ['Subject', 'Code', 'Attended', 'Delivered', 'Duty Leave'],
      rows,
    },
    keys,
  };
}

// ----------------------------------------------------------------- timetable

const to24 = (hour: number, meridiem: string | undefined): number => {
  const m = meridiem?.toLowerCase();
  if (m === 'pm' && hour < 12) return hour + 12;
  if (m === 'am' && hour === 12) return 0;
  return hour;
};

const hhmm = (hour: number, minute: string) =>
  `${String(hour).padStart(2, '0')}:${minute}`;

/** "09:40 - 10:20 AM" or "1:00 - 1:40 PM" to "09:40 - 10:20" / "13:00 - 13:40". */
export function slotTimeLabel(label: string): string | null {
  const m =
    /(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)?/i.exec(
      label,
    );
  if (!m) return null;
  const endHour = to24(Number(m[4]), m[6]);
  let startHour = to24(Number(m[1]), m[3] ?? m[6]);
  if (!m[3] && startHour * 60 + Number(m[2]) >= endHour * 60 + Number(m[5]))
    startHour = Math.max(0, startHour - 12);
  if (startHour > 23 || endHour > 23) return null;
  return `${hhmm(startHour, m[2] ?? '00')} - ${hhmm(endHour, m[5] ?? '00')}`;
}

const TYPE_LABEL: Record<string, string> = {
  L: 'Lecture',
  P: 'Practical',
  T: 'Tutorial',
};

// "CSB-421:L :: GP-All: By Steve Samson(E11030) at 1-3-C"
const CELL_ENTRY =
  /([A-Za-z0-9][A-Za-z0-9\-_/. ]*?)\s*:\s*([LPT])\s*::\s*GP-([^:]*):\s*By\s*([^()]*?)\s*(?:\([^)]*\))?\s*at\s*([^\s]+)/g;

const DAY_NAMES = /^(mon|tue|wed|thu|fri|sat)/i;
const DAY_NUMBER: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** Weekly grid plus course-code table to the flat "Day | Time | Subject | Room | Faculty | Type" layout. */
export function timetableTableFromHtml(html: string): RawTable | null {
  const tables = extractTables(html);
  const grid = tables.find(
    table => table.headers.filter(h => DAY_NAMES.test(h.trim())).length >= 2,
  );
  if (!grid) return null;

  const names = new Map<string, string>();
  for (const table of tables) {
    if (table === grid) continue;
    for (const row of [table.headers, ...table.rows]) {
      const code = (row[0] ?? '').trim();
      const name = (row[1] ?? '').trim();
      if (
        /^[A-Za-z0-9][A-Za-z0-9\-_/.]{2,}$/.test(code) &&
        name &&
        !/^(course\s*)?code$/i.test(code)
      )
        names.set(code, name);
    }
  }

  const rows: string[][] = [];
  for (const row of grid.rows) {
    const time = slotTimeLabel(row[0] ?? '');
    if (!time) continue;
    grid.headers.forEach((header, index) => {
      const day = DAY_NUMBER[header.trim().slice(0, 3).toLowerCase()];
      const cell = (row[index] ?? '').trim();
      if (!day || index === 0 || !cell) return;
      const dayName =
        [
          '',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ][day] ?? '';
      let matched = false;
      for (const entry of cell.matchAll(CELL_ENTRY)) {
        matched = true;
        const code = (entry[1] ?? '').trim();
        rows.push([
          dayName,
          time,
          names.get(code) ?? code,
          code,
          (entry[5] ?? '').trim().replace(/^\(+|\)+$/g, ''),
          (entry[4] ?? '').trim(),
          TYPE_LABEL[entry[2] ?? 'L'] ?? 'Lecture',
        ]);
      }
      if (!matched)
        rows.push([
          dayName,
          time,
          textOf(cell).slice(0, 120),
          '',
          '',
          '',
          'Lecture',
        ]);
    });
  }
  if (rows.length === 0) return null;
  return {
    caption: 'Timetable',
    headers: ['Day', 'Time', 'Subject', 'Code', 'Room', 'Faculty', 'Type'],
    rows,
  };
}

// --------------------------------------------------------------------- marks

/** The marks page is an accordion: one `<h3>` per subject followed by a `<div>` holding a small table. */
export function marksTableFromHtml(html: string): RawTable | null {
  const start = html.search(/id=["']accordion["']/i);
  if (start < 0) return null;
  const rows: string[][] = [];
  const section = html.slice(start);
  for (const block of section.matchAll(
    /<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<div\b[^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const subject = textOf(block[1] ?? '');
    if (!subject) continue;
    for (const tr of (block[2] ?? '').matchAll(
      /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,
    )) {
      const cells = Array.from(
        (tr[1] ?? '').matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
      ).map(c => textOf(c[1] ?? ''));
      if (cells.length >= 3 && cells[0])
        rows.push([subject, cells[0], cells[1] ?? '', cells[2] ?? '']);
    }
  }
  if (rows.length === 0) return null;
  return {
    caption: 'Marks',
    headers: ['Subject', 'Assessment', 'Max Marks', 'Obtained Marks'],
    rows,
  };
}

// ------------------------------------------------------------ attendance log

export type LogEntry = {
  title: string;
  code?: string;
  date: string;
  timing: string;
  status: 'PRESENT' | 'ABSENT' | 'DUTY_LEAVE' | 'OTHER';
};

export type CourseRef = { title: string; code?: string; encryptCode: string };

/** The subjects of the summary report, with the token needed to ask for each subject's lecture-by-lecture report. */
export function attendanceCourseRefs(items: unknown[]): CourseRef[] {
  const refs: CourseRef[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const title = pick(record, [
      'Title',
      'SubjectName',
      'CourseName',
      'Subject',
    ]);
    const encryptCode = pick(record, ['EncryptCode']);
    if (title && encryptCode)
      refs.push({
        title,
        code: pick(record, ['CourseCode', 'SubjectCode', 'Code']),
        encryptCode,
      });
  }
  return refs;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
    2,
    '0',
  )}`;
}

/** Reads the portal's date text (day-first in India) into YYYY-MM-DD; null when it cannot be understood. */
export function parseAttDate(raw: string): string | null {
  const text = raw.trim();
  let m = /\/Date\((-?\d+)/.exec(text);
  if (m) {
    const shifted = new Date(Number(m[1]) + 5.5 * 3600 * 1000);
    return isoDate(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate(),
    );
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/.exec(text);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /(\d{1,2})(?:st|nd|rd|th)?[\s\-.,]+([A-Za-z]{3,9})[\s\-.,]+(\d{4})/.exec(
    text,
  );
  if (m)
    return isoDate(
      Number(m[3]),
      MONTHS[(m[2] ?? '').slice(0, 3).toLowerCase()] ?? 0,
      Number(m[1]),
    );
  m = /([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(text);
  if (m)
    return isoDate(
      Number(m[3]),
      MONTHS[(m[1] ?? '').slice(0, 3).toLowerCase()] ?? 0,
      Number(m[2]),
    );
  return null;
}

export function statusFromCode(code: string): LogEntry['status'] {
  const c = code.trim().toUpperCase();
  if (c === 'P' || c === 'PRESENT') return 'PRESENT';
  if (c === 'A' || c === 'ABSENT') return 'ABSENT';
  if (/^(DL|ML|OD|DUTY|MEDICAL|ON\s*DUTY)/.test(c)) return 'DUTY_LEAVE';
  return 'OTHER';
}

/** Shape of a date string with digits and letters masked, safe to show in diagnostics. */
export const maskShape = (value: string) =>
  value
    .trim()
    .replace(/\d/g, '9')
    .replace(/[A-Za-z]/g, 'a')
    .slice(0, 30);

export type SelectOption = { value: string; text: string; selected: boolean };

/** Options of the `<select>` whose id/name contains `idPart` (case-insensitive). */
export function selectOptions(html: string, idPart: string): SelectOption[] {
  const select = new RegExp(
    `<select\\b[^>]*(?:id|name)\\s*=\\s*["'][^"']*${idPart}[^"']*["'][^>]*>([\\s\\S]*?)</select>`,
    'i',
  ).exec(html);
  if (!select?.[1]) return [];
  const options: SelectOption[] = [];
  for (const match of select[1].matchAll(
    /<option\b([^>]*)>([\s\S]*?)<\/option>/gi,
  )) {
    const attrs = match[1] ?? '';
    options.push({
      value:
        /value\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ??
        textOf(match[2] ?? ''),
      text: textOf(match[2] ?? ''),
      selected: /\sselected\b/i.test(` ${attrs}`),
    });
  }
  return options;
}

/**
 * The portal's own script posts `{course, UID, fromDate, toDate, type, Session}` where the dates are the text
 * "0" when no range is chosen, `type` is the value of the filter drop-down and `Session` is the selected session.
 * Returns the `type` values worth trying, the one the page itself would send first.
 */
export function fullReportTypes(html: string): string[] {
  const options = selectOptions(html, 'drpfilter');
  const tillDate = options.find(
    o => /till|all/i.test(o.text) && o.value !== 'DS',
  );
  const initial =
    options.find(o => o.selected && o.value !== 'DS') ??
    options.find(o => o.value !== 'DS');
  return Array.from(
    new Set(
      [tillDate?.value, initial?.value, 'All', 'TD'].filter(
        (v): v is string => v !== undefined,
      ),
    ),
  );
}

export function selectedSessionValue(html: string): string | undefined {
  const options = selectOptions(html, 'ddlSession');
  const chosen = options.find(o => o.selected) ?? options[0];
  return chosen?.value && chosen.value !== '0' ? chosen.value : undefined;
}

export const fullReportBody = (
  course: string,
  reportId: string,
  session: string,
  type: string,
) =>
  JSON.stringify({
    course,
    UID: reportId,
    fromDate: '0',
    toDate: '0',
    type,
    Session: session,
  });

/** Short, value-free reason a page-method call failed (ASP.NET puts it in `Message`). */
export function describeFailure(status: number, body: string): string {
  let message = '';
  try {
    const parsed = JSON.parse(body) as { Message?: unknown };
    if (typeof parsed.Message === 'string') message = parsed.Message;
  } catch {
    message = textOf(body).slice(0, 80);
  }
  return `status ${status}${message ? `: ${message.slice(0, 100)}` : ''}`;
}

const ROMAN: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};
const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];

/** "1", "01", "I", "1st", "First Semester" or "Semester 3" to a number 1-12, or undefined. */
export function parseSemester(raw: string): number | undefined {
  const text = raw.trim().toLowerCase();
  const digits = /(\d{1,2})/.exec(text)?.[1];
  if (digits) {
    const n = Number(digits);
    return n >= 1 && n <= 12 ? n : undefined;
  }
  const ordinal = ORDINALS.findIndex(word => text.includes(word));
  if (ordinal >= 0) return ordinal + 1;
  const roman = /\b(x|ix|viii|vii|vi|iv|v|iii|ii|i)\b/.exec(text)?.[1];
  return roman ? ROMAN[roman] : undefined;
}

/** The semester the summary report says the student is in (the most common value across subjects). */
export function semesterFromReport(items: unknown[]): number | undefined {
  const counts = new Map<number, number>();
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const raw = pick(item as Record<string, unknown>, [
      'Semester',
      'Sem',
      'SemesterNo',
    ]);
    const n = raw ? parseSemester(raw) : undefined;
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** The numeric student id the portal uses for the mentor lookup, when the summary report carries it. */
export function studentIdFromReport(items: unknown[]): string | undefined {
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const id = pick(item as Record<string, unknown>, [
      'StudentId',
      'StudentID',
      'IDNo',
    ]);
    if (id && /^\d{3,}$/.test(id)) return id;
  }
  return undefined;
}

export function attendanceLogFromReport(
  items: unknown[],
  course: CourseRef,
): {
  entries: LogEntry[];
  dropped: number;
  codes: string[];
  keys: string[];
  badShape?: string;
  section?: string;
  group?: string;
} {
  const entries: LogEntry[] = [];
  const codes = new Set<string>();
  let dropped = 0;
  let badShape: string | undefined;
  let section: string | undefined;
  let group: string | undefined;
  const keys = new Set<string>();
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    Object.keys(record).forEach(key => keys.add(key));
    section ??= pick(record, ['Section']);
    group ??= pick(record, ['StudentGroup', 'Group']);
    const rawDate = pick(record, ['AttDate', 'AttendanceDate', 'Date']) ?? '';
    const rawCode =
      pick(record, ['AttendanceCode', 'Status', 'AttStatus']) ?? '';
    const date = parseAttDate(rawDate);
    if (!date || !rawCode) {
      dropped += 1;
      badShape ??= maskShape(rawDate);
      continue;
    }
    codes.add(rawCode.toUpperCase().slice(0, 6));
    entries.push({
      title: course.title,
      code: course.code,
      date,
      timing: (pick(record, ['Timing', 'Time', 'Slot']) ?? '').slice(0, 80),
      status: statusFromCode(rawCode),
    });
  }
  return {
    entries,
    dropped,
    codes: Array.from(codes),
    keys: Array.from(keys).slice(0, 20),
    badShape,
    section,
    group,
  };
}
