/**
 * Header-driven parser for tables captured from a student's own logged-in CUIMS
 * session. It never talks to the network. Tables whose headers are not
 * recognised are returned in `unrecognized` so the layout can be tuned instead
 * of silently guessed.
 */

export type RawTable = {
  caption?: string;
  headers: string[];
  rows: string[][];
};

export type ParsedAttendance = {
  courseCode: string;
  courseName: string;
  facultyName?: string;
  attendedClasses: number;
  deliveredClasses: number;
  dutyLeave: number;
};

export type ParsedTimetableSlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  room: string;
  facultyName?: string;
  slotType: "LECTURE" | "LAB" | "TUTORIAL";
};

export type ParsedMark = {
  courseCode: string;
  courseName: string;
  assessmentName: string;
  category: "THEORY" | "PRACTICAL" | "INTERNAL";
  obtainedMarks: number;
  maxMarks: number;
};

export type ParseResult = {
  attendance: ParsedAttendance[];
  timetable: ParsedTimetableSlot[];
  marks: ParsedMark[];
  unrecognized: { headers: string[]; reason: string }[];
};

const COURSE_CODE = /\b\d{2}[A-Z]{2,6}-?\d{3,4}\b/i;

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const norm = (value: string) => clean(value).toLowerCase();

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const match = clean(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function findIndex(headers: string[], test: RegExp, exclude?: RegExp): number {
  return headers.findIndex(
    (header) => test.test(header) && !(exclude && exclude.test(header)),
  );
}

export function splitCourse(
  raw: string,
  codeCell?: string,
): { courseCode: string; courseName: string } {
  const text = clean(raw);
  const code = clean(codeCell ?? "") || text.match(COURSE_CODE)?.[0] || "";
  let name = text;
  if (code) {
    name = clean(
      text.replace(code, "").replace(/^[\s\-:|()[\]]+|[\s\-:|()[\]]+$/g, ""),
    );
  }
  if (!name) name = code || text;
  const courseCode = (
    code ||
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .slice(0, 24)
  ).toUpperCase();
  return { courseCode, courseName: name };
}

export function normalizeTime(value: string): string | null {
  const match = clean(value).match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const TIME_RANGE =
  /(\d{1,2}\s*[:.]\s*\d{2}\s*(?:am|pm)?)\s*(?:-|–|—|to)\s*(\d{1,2}\s*[:.]\s*\d{2}\s*(?:am|pm)?)/i;

function parseTimeRange(value: string): { start: string; end: string } | null {
  const match = clean(value).match(TIME_RANGE);
  if (!match) return null;
  const start = normalizeTime(match[1] ?? "");
  const end = normalizeTime(match[2] ?? "");
  return start && end ? { start, end } : null;
}

const DAYS: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseDay(value: string): number | null {
  const key = norm(value).slice(0, 3);
  return DAYS[key] ?? null;
}

function slotTypeOf(text: string): "LECTURE" | "LAB" | "TUTORIAL" {
  const lower = text.toLowerCase();
  if (/\blab\b|practical|workshop/.test(lower)) return "LAB";
  if (/tutorial|\btut\b/.test(lower)) return "TUTORIAL";
  return "LECTURE";
}

function parseAttendance(
  headers: string[],
  rows: string[][],
): ParsedAttendance[] | null {
  const codeIdx = findIndex(headers, /code/);
  const nameIdx = findIndex(headers, /subject|course|paper|title/, /code/);
  const deliveredIdx = findIndex(
    headers,
    /deliver|held|conducted|total\s*(lect|class|session)|^total$/,
  );
  let attendedIdx = findIndex(headers, /attended/);
  if (attendedIdx < 0) attendedIdx = findIndex(headers, /present/, /%|percent/);
  const dutyIdx = findIndex(headers, /duty|\bdl\b/);
  const facultyIdx = findIndex(headers, /faculty|teacher|instructor/);
  if ((nameIdx < 0 && codeIdx < 0) || deliveredIdx < 0 || attendedIdx < 0)
    return null;

  const result: ParsedAttendance[] = [];
  for (const row of rows) {
    const delivered = toNumber(row[deliveredIdx]);
    const attended = toNumber(row[attendedIdx]);
    if (
      delivered === null ||
      attended === null ||
      delivered < 0 ||
      attended < 0
    )
      continue;
    const label = row[nameIdx >= 0 ? nameIdx : codeIdx] ?? "";
    if (!clean(label)) continue;
    const course = splitCourse(
      label,
      codeIdx >= 0 && nameIdx >= 0 ? row[codeIdx] : undefined,
    );
    result.push({
      ...course,
      facultyName:
        facultyIdx >= 0 ? clean(row[facultyIdx] ?? "") || undefined : undefined,
      attendedClasses: attended,
      deliveredClasses: Math.max(delivered, attended),
      dutyLeave: dutyIdx >= 0 ? (toNumber(row[dutyIdx]) ?? 0) : 0,
    });
  }
  return result.length > 0 ? result : null;
}

function parseMarksLong(
  headers: string[],
  rows: string[][],
  caption?: string,
): ParsedMark[] | null {
  const codeIdx = findIndex(headers, /code/);
  const nameIdx = findIndex(headers, /subject|course|paper|title/, /code/);
  const obtainedIdx = findIndex(
    headers,
    /obtained|scored|secured|marks\s*(awarded|received)|^marks$/,
  );
  const maxIdx = findIndex(headers, /max|out\s*of|full\s*marks|total\s*marks/);
  const assessIdx = findIndex(
    headers,
    /exam|assessment|component|evaluation|test|type/,
  );
  if ((nameIdx < 0 && codeIdx < 0) || obtainedIdx < 0 || maxIdx < 0)
    return null;

  const result: ParsedMark[] = [];
  for (const row of rows) {
    const obtained = toNumber(row[obtainedIdx]);
    const max = toNumber(row[maxIdx]);
    if (obtained === null || max === null || max <= 0 || obtained < 0) continue;
    const label = row[nameIdx >= 0 ? nameIdx : codeIdx] ?? "";
    if (!clean(label)) continue;
    const course = splitCourse(
      label,
      codeIdx >= 0 && nameIdx >= 0 ? row[codeIdx] : undefined,
    );
    const assessmentName =
      clean(assessIdx >= 0 ? (row[assessIdx] ?? "") : (caption ?? "")) ||
      "Assessment";
    result.push({
      ...course,
      assessmentName,
      category: categoryOf(assessmentName),
      obtainedMarks: obtained,
      maxMarks: max,
    });
  }
  return result.length > 0 ? result : null;
}

const ASSESSMENT_HEADER =
  /mst|mid|quiz|assign|lab|practical|internal|\bca\b|test|viva|project|worksheet|ete|\bet\b/i;

function categoryOf(name: string): "THEORY" | "PRACTICAL" | "INTERNAL" {
  if (/lab|practical|viva|worksheet/i.test(name)) return "PRACTICAL";
  if (/mst|mid|ete|end\s*sem|\bet\b/i.test(name)) return "THEORY";
  return "INTERNAL";
}

function parseMarksWide(
  headers: string[],
  rows: string[][],
  originalHeaders: string[],
): ParsedMark[] | null {
  const codeIdx = findIndex(headers, /code/);
  const nameIdx = findIndex(headers, /subject|course|paper|title/, /code/);
  if (nameIdx < 0 && codeIdx < 0) return null;
  const columns = headers
    .map((header, index) => ({ header, index }))
    .filter(
      ({ header, index }) =>
        index !== nameIdx &&
        index !== codeIdx &&
        ASSESSMENT_HEADER.test(header),
    );
  if (columns.length === 0) return null;

  const result: ParsedMark[] = [];
  for (const row of rows) {
    const label = row[nameIdx >= 0 ? nameIdx : codeIdx] ?? "";
    if (!clean(label)) continue;
    const course = splitCourse(
      label,
      codeIdx >= 0 && nameIdx >= 0 ? row[codeIdx] : undefined,
    );
    for (const { header, index } of columns) {
      const cell = clean(row[index] ?? "");
      if (!cell || /^(-|na|n\/a|ab|absent)$/i.test(cell)) continue;
      const pair = cell.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      const obtained = pair ? Number(pair[1]) : toNumber(cell);
      const headerMax = header.match(/\((\d+(?:\.\d+)?)\)/);
      const max = pair ? Number(pair[2]) : headerMax ? Number(headerMax[1]) : 0;
      if (obtained === null || !Number.isFinite(obtained)) continue;
      const assessmentName = clean(
        (originalHeaders[index] ?? header).replace(
          /\(\s*\d+(?:\.\d+)?\s*\)/,
          "",
        ),
      );
      result.push({
        ...course,
        assessmentName,
        category: categoryOf(assessmentName),
        obtainedMarks: obtained,
        maxMarks: max,
      });
    }
  }
  return result.length > 0 ? result : null;
}

function parseCell(
  cell: string,
): { courseCode: string; courseName: string; room: string } | null {
  const text = clean(cell);
  if (!text || /^(-|--|free|break|lunch|na|n\/a)$/i.test(text)) return null;
  const tokens = cell
    .split(/\n|\||,|;/)
    .map(clean)
    .filter(Boolean);
  const roomToken = tokens.find(
    (token) =>
      /\b(block|room|lab|hall)\b|\b[A-Z]\d{0,2}-\d{2,4}\b/i.test(token) &&
      !COURSE_CODE.test(token),
  );
  const subjectTokens = tokens.filter((token) => token !== roomToken);
  const course = splitCourse(subjectTokens.join(" ") || text);
  return { ...course, room: roomToken ?? "" };
}

function parseTimetable(
  headers: string[],
  rows: string[][],
): ParsedTimetableSlot[] | null {
  // Layout A: one row per slot (Day | Time | Subject | Room | Faculty)
  const dayIdx = findIndex(headers, /^day$|weekday/);
  const timeIdx = findIndex(headers, /time|slot|period|lecture\s*time/);
  const subjectIdx = findIndex(headers, /subject|course|paper/, /code/);
  if (dayIdx >= 0 && timeIdx >= 0 && subjectIdx >= 0) {
    const codeIdx = findIndex(headers, /code/);
    const roomIdx = findIndex(headers, /room|venue|location|block/);
    const facultyIdx = findIndex(headers, /faculty|teacher|instructor/);
    const typeIdx = findIndex(headers, /^type$|slot\s*type|lecture\s*type/);
    const result: ParsedTimetableSlot[] = [];
    for (const row of rows) {
      const day = parseDay(row[dayIdx] ?? "");
      const range = parseTimeRange(row[timeIdx] ?? "");
      const subject = clean(row[subjectIdx] ?? "");
      if (!day || !range || !subject) continue;
      const course = splitCourse(
        subject,
        codeIdx >= 0 ? row[codeIdx] : undefined,
      );
      result.push({
        dayOfWeek: day,
        startTime: range.start,
        endTime: range.end,
        ...course,
        room: roomIdx >= 0 ? clean(row[roomIdx] ?? "") : "",
        facultyName:
          facultyIdx >= 0
            ? clean(row[facultyIdx] ?? "") || undefined
            : undefined,
        slotType: slotTypeOf(
          typeIdx >= 0 ? `${row[typeIdx] ?? ""} ${subject}` : subject,
        ),
      });
    }
    return result.length > 0 ? result : null;
  }

  // Layout B: weekly grid (first column = day, other columns = time ranges)
  const ranges = headers.map((header) => parseTimeRange(header));
  if (ranges.filter(Boolean).length >= 2) {
    const result: ParsedTimetableSlot[] = [];
    for (const row of rows) {
      const day = parseDay(row[0] ?? "");
      if (!day) continue;
      row.forEach((cell, index) => {
        const range = ranges[index];
        if (!range || index === 0) return;
        const parsed = parseCell(cell);
        if (!parsed) return;
        result.push({
          dayOfWeek: day,
          startTime: range.start,
          endTime: range.end,
          ...parsed,
          slotType: slotTypeOf(cell),
        });
      });
    }
    return result.length > 0 ? result : null;
  }
  return null;
}

export function parseCuimsTables(tables: RawTable[]): ParseResult {
  const result: ParseResult = {
    attendance: [],
    timetable: [],
    marks: [],
    unrecognized: [],
  };
  for (const table of tables) {
    const headers = table.headers.map(norm);
    const rows = table.rows;
    if (headers.length === 0 || rows.length === 0) continue;

    const attendance = parseAttendance(headers, rows);
    if (attendance) {
      result.attendance.push(...attendance);
      continue;
    }
    const timetable = parseTimetable(headers, rows);
    if (timetable) {
      result.timetable.push(...timetable);
      continue;
    }
    const marks =
      parseMarksLong(headers, rows, table.caption) ??
      parseMarksWide(headers, rows, table.headers);
    if (marks) {
      result.marks.push(...marks);
      continue;
    }
    result.unrecognized.push({
      headers: table.headers.slice(0, 10).map(clean),
      reason: "Columns did not match attendance, timetable or marks layouts",
    });
  }
  return result;
}
