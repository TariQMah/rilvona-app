import { decodeEntities, extractTables, type RawTable } from './htmlTables';

/** One exam on the student's date sheet. Personal columns such as the UID are never kept. */
export type ExamEntry = {
  /** Which sheet it belongs to, for example "MST-1" or "MST-2". */
  sheet: string;
  /** "Regular", "Reappear"… as the portal words it. */
  examType: string;
  courseCode: string;
  courseName: string;
  slot: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** 24-hour `HH:mm`, or empty when the portal gives none. */
  time: string;
  venue: string;
  mode: string;
  kind: 'theory' | 'practical';
};

export type Datesheet = {
  entries: ExamEntry[];
  /** Whether the practical page answered at all (it often has nothing published). */
  practicalChecked: boolean;
  fetchedAt: string;
};

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Reads "20 Oct 2026", "Tue, 20 October 2026", "20/10/2026", "20-10-2026" or "2026-10-20". */
export function parseExamDate(text: string): string | null {
  const t = text.trim();
  let m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(t);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  m = /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/.exec(t);
  if (m) {
    const month = MONTHS.indexOf((m[2] ?? '').slice(0, 3).toLowerCase());
    if (month >= 0) return `${m[3]}-${pad(month + 1)}-${pad(Number(m[1]))}`;
  }
  return null;
}

/** Reads "09:00", "9:30 AM" or "1.30 PM" as 24-hour `HH:mm`; the start time when a range is given. */
export function parseExamTime(text: string): string {
  const m = /(\d{1,2})\s*[:.]\s*(\d{2})(?:\s*(am|pm))?/i.exec(text.trim());
  if (!m) return '';
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return '';
  return `${pad(hour)}:${pad(minute)}`;
}

type Column =
  | 'sheet'
  | 'examType'
  | 'courseCode'
  | 'courseName'
  | 'slot'
  | 'date'
  | 'time'
  | 'venue'
  | 'mode';

/** Which column holds what, judged from the header words. The UID, new slot and error-report columns are ignored. */
export function datesheetColumns(
  headers: string[],
): Partial<Record<Column, number>> {
  const columns: Partial<Record<Column, number>> = {};
  const set = (key: Column, index: number) => {
    if (columns[key] === undefined) columns[key] = index;
  };
  headers.forEach((raw, index) => {
    const h = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^new\b|uid|error|report/.test(h)) return;
    if (/date\s*sheet\s*type|^datesheettype$/.test(h)) set('sheet', index);
    else if (/exam\s*type/.test(h)) set('examType', index);
    else if (/course\s*code|subject\s*code|paper\s*code/.test(h))
      set('courseCode', index);
    else if (
      /course\s*name|subject(\s*name)?|paper(\s*name)?|course\s*title|^course$/.test(
        h,
      )
    )
      set('courseName', index);
    else if (/slot/.test(h)) set('slot', index);
    else if (/date/.test(h)) set('date', index);
    else if (/timing|time|shift/.test(h)) set('time', index);
    else if (/venue|room|centre|center|block|location/.test(h))
      set('venue', index);
    else if (/mode/.test(h)) set('mode', index);
  });
  return columns;
}

function entriesOf(table: RawTable, kind: ExamEntry['kind']): ExamEntry[] {
  const columns = datesheetColumns(table.headers);
  if (
    columns.date === undefined ||
    (columns.courseName === undefined && columns.courseCode === undefined)
  )
    return [];
  const cell = (row: string[], key: Column) =>
    columns[key] === undefined
      ? ''
      : (row[columns[key] as number] ?? '').trim();
  const out: ExamEntry[] = [];
  for (const row of table.rows) {
    const date = parseExamDate(cell(row, 'date'));
    const name = cell(row, 'courseName') || cell(row, 'courseCode');
    if (!date || !name) continue;
    out.push({
      sheet:
        cell(row, 'sheet') || (kind === 'practical' ? 'Practical' : 'Exam'),
      examType: cell(row, 'examType'),
      courseCode: cell(row, 'courseCode'),
      courseName: name,
      slot: cell(row, 'slot'),
      date,
      time: parseExamTime(cell(row, 'time')),
      venue: cell(row, 'venue'),
      mode: cell(row, 'mode'),
      kind,
    });
  }
  return out;
}

/** The HTML string ASP.NET WebMethods return as `{ "d": "<html>..." }`. */
export function htmlFromPageMethod(body: string): string | null {
  try {
    const outer = JSON.parse(body) as { d?: unknown };
    return typeof outer.d === 'string' ? outer.d : null;
  } catch {
    return null;
  }
}

const DATESHEET_FILES: Record<ExamEntry['kind'], string> = {
  theory: 'frmStudentDatesheet.aspx',
  practical: 'frmStudentPracticleDateSheet.aspx',
};

/** The portal menu href for a date sheet page, including `?type=` when CUIMS puts one on it. */
export function datesheetPathFromMenu(
  html: string,
  kind: ExamEntry['kind'],
): string | null {
  const file = DATESHEET_FILES[kind];
  const decoded = decodeEntities(html);
  const index = decoded.toLowerCase().indexOf(file.toLowerCase());
  if (index < 0) return null;
  const slice = decoded.slice(index);
  const end = slice.search(/['"\s#>]/);
  return slice.slice(0, end < 0 ? slice.length : end);
}

/** Every exam in the date sheet tables of one portal page, in date order. */
export function parseDatesheet(
  html: string,
  kind: ExamEntry['kind'] = 'theory',
): ExamEntry[] {
  return extractTables(html)
    .flatMap(table => entriesOf(table, kind))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.courseName.localeCompare(b.courseName),
    );
}

/** Days from `now` (local date) to an ISO date; negative once it has passed. */
export function daysToExam(iso: string, now: Date = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(
    (Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      864e5,
  );
}

/** The exam sheets present, in a stable order ("MST-1" before "MST-2", practical last). */
export function sheetsOf(entries: ExamEntry[]): string[] {
  const names = Array.from(new Set(entries.map(e => e.sheet)));
  return names.sort((a, b) => {
    const pa = entries.find(e => e.sheet === a)?.kind === 'practical' ? 1 : 0;
    const pb = entries.find(e => e.sheet === b)?.kind === 'practical' ? 1 : 0;
    return pa - pb || a.localeCompare(b, undefined, { numeric: true });
  });
}

/** The first exam that has not finished its day yet. */
export function nextExam(
  entries: ExamEntry[],
  now: Date = new Date(),
): ExamEntry | null {
  return entries.find(e => daysToExam(e.date, now) >= 0) ?? null;
}
