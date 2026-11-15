import type {
  AcademicsOverview,
  AttendanceCourse,
  AttendanceHistoryEntry,
  CourseMarkItem,
  TimetableSlotItem,
} from '../../api/types';

export type ConnectedOverview = Extract<AcademicsOverview, { connected: true }>;

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function clock12(hhmm: string): string {
  const total = toMinutes(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${
    h >= 12 ? 'PM' : 'AM'
  }`;
}

export function slotsForDay(
  timetable: TimetableSlotItem[],
  day: number,
): TimetableSlotItem[] {
  return timetable
    .filter(slot => slot.dayOfWeek === day)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

export function dayCounts(
  timetable: TimetableSlotItem[],
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const slot of timetable)
    counts[slot.dayOfWeek] = (counts[slot.dayOfWeek] ?? 0) + 1;
  return counts;
}

export type ClassStatus =
  | { kind: 'live'; slot: TimetableSlotItem; minutesLeft: number }
  | { kind: 'next'; slot: TimetableSlotItem; minutesUntil: number }
  | { kind: 'none' };

/** Sunday (0) has no timetable. Days are 1 (Mon) to 6 (Sat). */
export function classStatus(
  timetable: TimetableSlotItem[],
  now: Date = new Date(),
): ClassStatus {
  const day = now.getDay();
  if (day === 0) return { kind: 'none' };
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = slotsForDay(timetable, day);
  const live = today.find(
    slot =>
      toMinutes(slot.startTime) <= minutes && minutes < toMinutes(slot.endTime),
  );
  if (live)
    return {
      kind: 'live',
      slot: live,
      minutesLeft: toMinutes(live.endTime) - minutes,
    };
  const next = today.find(slot => toMinutes(slot.startTime) > minutes);
  if (next)
    return {
      kind: 'next',
      slot: next,
      minutesUntil: toMinutes(next.startTime) - minutes,
    };
  return { kind: 'none' };
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** The first class on the next day that has any, with a friendly day name ("Tomorrow", "Wednesday"). */
export function nextDayClass(
  timetable: TimetableSlotItem[],
  now: Date = new Date(),
): { dayName: string; slot: TimetableSlotItem } | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = (now.getDay() + offset) % 7;
    if (day === 0) continue;
    const slot = slotsForDay(timetable, day)[0];
    if (slot)
      return { dayName: offset === 1 ? 'Tomorrow' : WEEKDAYS[day] ?? '', slot };
  }
  return null;
}

/** Mentor details with the portal's template values ("value1") and empty cards removed. */
export function realMentor<T extends { lines: string[]; name?: string }>(
  mentor: T | null | undefined,
): T | null {
  if (!mentor) return null;
  const real = (line: string) =>
    !/^(value\s*\d*|string|null|undefined|n\/?a|-+)$/i.test(line.trim());
  const lines = mentor.lines.filter(real);
  const name = mentor.name && real(mentor.name) ? mentor.name : undefined;
  if (lines.length === 0 && !name) return null;
  return { ...mentor, name, lines };
}

/** 0..1 through the slot, for the live ring. */
export function slotProgress(
  slot: Pick<TimetableSlotItem, 'startTime' | 'endTime'>,
  now: Date = new Date(),
): number {
  const start = toMinutes(slot.startTime);
  const end = toMinutes(slot.endTime);
  if (end <= start) return 0;
  const minutes =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return Math.max(0, Math.min(1, (minutes - start) / (end - start)));
}

/** The class after `slot` today, if any. */
export function slotAfter(
  timetable: TimetableSlotItem[],
  slot: TimetableSlotItem,
): TimetableSlotItem | undefined {
  return slotsForDay(timetable, slot.dayOfWeek).find(
    s => toMinutes(s.startTime) >= toMinutes(slot.endTime),
  );
}

const pct = (attended: number, delivered: number) =>
  delivered > 0 ? Math.round((attended / delivered) * 1000) / 10 : 100;

/** Attendance if the student goes to the next lecture. */
export const percentIfAttend = (
  c: Pick<AttendanceCourse, 'attendedClasses' | 'deliveredClasses'>,
) => pct(c.attendedClasses + 1, c.deliveredClasses + 1);

/** Attendance if the student skips the next lecture. */
export const percentIfSkip = (
  c: Pick<AttendanceCourse, 'attendedClasses' | 'deliveredClasses'>,
) => pct(c.attendedClasses, c.deliveredClasses + 1);

export type Tone = 'safe' | 'edge' | 'short';

export function toneOf(course: AttendanceCourse): Tone {
  if (course.guidance.status === 'SHORTAGE') return 'short';
  if (course.guidance.status === 'BORDERLINE') return 'edge';
  return 'safe';
}

export function guidanceText(course: AttendanceCourse): string {
  const { guidance } = course;
  if (guidance.status === 'SHORTAGE') {
    return `Attend next ${guidance.needToAttend} class${
      guidance.needToAttend === 1 ? '' : 'es'
    }`;
  }
  if (guidance.status === 'BORDERLINE') return "Don't miss the next class";
  return `Safe to miss ${guidance.canMiss} class${
    guidance.canMiss === 1 ? '' : 'es'
  }`;
}

/** The advice in a few words, for tight rows. */
export function guidanceShort(course: AttendanceCourse): string {
  const { guidance } = course;
  if (guidance.status === 'SHORTAGE')
    return `Attend ${guidance.needToAttend} more`;
  if (guidance.status === 'BORDERLINE') return "Don't skip";
  return guidance.canMiss === 0 ? "Don't skip" : `Can skip ${guidance.canMiss}`;
}

export function shortName(name: string, max = 8): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > max ? `${first.slice(0, max)}..` : first;
}

const STOP_WORDS = new Set([
  'of',
  'and',
  '&',
  'the',
  'to',
  'for',
  'in',
  'a',
  'an',
]);

/** Compact, distinguishable chart label: "Design and Analysis of Algorithms Lab" -> "DAA Lab". */
export function radarLabel(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lab = words.length > 1 && /^lab$/i.test(words[words.length - 1] ?? '');
  const core = (lab ? words.slice(0, -1) : words).filter(
    w => !STOP_WORDS.has(w.toLowerCase()),
  );
  let base: string;
  if (core.length <= 2) base = (core[0] ?? name).slice(0, 9);
  else
    base = core
      .map(w => (w[0] ?? '').toUpperCase())
      .join('')
      .slice(0, 5);
  return lab ? `${base} Lab` : base;
}

export type SubjectMarks = {
  courseCode: string;
  courseName: string;
  items: CourseMarkItem[];
  obtained: number;
  max: number;
  percent: number | null;
};

/** Percent only counts assessments whose maximum is known. */
export function groupMarks(marks: CourseMarkItem[]): SubjectMarks[] {
  const map = new Map<string, SubjectMarks>();
  for (const mark of marks) {
    const group = map.get(mark.courseCode) ?? {
      courseCode: mark.courseCode,
      courseName: mark.courseName,
      items: [],
      obtained: 0,
      max: 0,
      percent: null,
    };
    group.items.push(mark);
    if (mark.maxMarks > 0) {
      group.obtained += mark.obtainedMarks;
      group.max += mark.maxMarks;
    }
    map.set(mark.courseCode, group);
  }
  return Array.from(map.values()).map(group => ({
    ...group,
    percent:
      group.max > 0
        ? Math.round((group.obtained / group.max) * 1000) / 10
        : null,
  }));
}

export function averagePercent(groups: SubjectMarks[]): number | null {
  const known = groups.filter(g => g.percent !== null);
  if (known.length === 0) return null;
  return (
    Math.round(
      (known.reduce((sum, g) => sum + (g.percent ?? 0), 0) / known.length) * 10,
    ) / 10
  );
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Score of one assessment as a percentage, or null when its maximum is unknown. */
export function markPercent(
  mark: Pick<CourseMarkItem, 'obtainedMarks' | 'maxMarks'>,
): number | null {
  return mark.maxMarks > 0
    ? round1((mark.obtainedMarks / mark.maxMarks) * 100)
    : null;
}

export type MarkKind = 'THEORY' | 'PRACTICAL' | 'INTERNAL';
export const MARK_KIND_LABEL: Record<MarkKind, string> = {
  THEORY: 'Theory',
  PRACTICAL: 'Practical',
  INTERNAL: 'Internal',
};
const KIND_ORDER: MarkKind[] = ['THEORY', 'INTERNAL', 'PRACTICAL'];
export const kindOf = (category: string): MarkKind =>
  (KIND_ORDER as string[]).includes(category)
    ? (category as MarkKind)
    : 'INTERNAL';

/** Theory first, then internal, then practical; numbered items in natural order (Worksheet 2 before 10). */
export function sortAssessments(items: CourseMarkItem[]): CourseMarkItem[] {
  return [...items].sort((a, b) => {
    const kind =
      KIND_ORDER.indexOf(kindOf(a.category)) -
      KIND_ORDER.indexOf(kindOf(b.category));
    if (kind !== 0) return kind;
    return a.assessmentName.localeCompare(b.assessmentName, undefined, {
      numeric: true,
    });
  });
}

/** The kinds of assessment actually present, in display order. */
export function marksKinds(marks: CourseMarkItem[]): MarkKind[] {
  const present = new Set(marks.map(m => kindOf(m.category)));
  return KIND_ORDER.filter(kind => present.has(kind));
}

export function filterMarks(
  marks: CourseMarkItem[],
  kind: MarkKind | 'ALL',
): CourseMarkItem[] {
  return kind === 'ALL'
    ? marks
    : marks.filter(m => kindOf(m.category) === kind);
}

/** Per-kind totals for one subject, e.g. theory 60% and practical 88%. */
export function kindBreakdown(items: CourseMarkItem[]): {
  kind: MarkKind;
  obtained: number;
  max: number;
  percent: number | null;
  count: number;
}[] {
  return marksKinds(items).map(kind => {
    const part = items.filter(i => kindOf(i.category) === kind);
    const known = part.filter(i => i.maxMarks > 0);
    const obtained = known.reduce((s, i) => s + i.obtainedMarks, 0);
    const max = known.reduce((s, i) => s + i.maxMarks, 0);
    return {
      kind,
      obtained,
      max,
      percent: max > 0 ? round1((obtained / max) * 100) : null,
      count: part.length,
    };
  });
}

export type WeakAssessment = {
  courseCode: string;
  courseName: string;
  assessmentName: string;
  obtained: number;
  max: number;
  percent: number;
};

export type MarksInsights = {
  average: number | null;
  best: SubjectMarks | null;
  lowest: SubjectMarks | null;
  ranked: SubjectMarks[];
  weak: WeakAssessment[];
  obtained: number;
  max: number;
};

/** Everything the Marks summary needs, derived from the grouped subjects. */
export function marksInsights(
  groups: SubjectMarks[],
  weakBelow = 60,
  weakLimit = 4,
): MarksInsights {
  const ranked = groups
    .filter(g => g.percent !== null)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const weak = groups
    .flatMap(g =>
      g.items.flatMap(item => {
        const percent = markPercent(item);
        return percent !== null && percent < weakBelow
          ? [
              {
                courseCode: g.courseCode,
                courseName: g.courseName,
                assessmentName: item.assessmentName,
                obtained: item.obtainedMarks,
                max: item.maxMarks,
                percent,
              },
            ]
          : [];
      }),
    )
    .sort((a, b) => a.percent - b.percent)
    .slice(0, weakLimit);
  return {
    average: averagePercent(groups),
    best: ranked[0] ?? null,
    lowest: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    ranked,
    weak,
    obtained: groups.reduce((s, g) => s + g.obtained, 0),
    max: groups.reduce((s, g) => s + g.max, 0),
  };
}

export function marksTone(percent: number | null): Tone | 'none' {
  if (percent === null) return 'none';
  return percent >= 75 ? 'safe' : percent >= 50 ? 'edge' : 'short';
}

export function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  if (!first) return 'Student';
  // the portal writes names in capitals: show "Karan", not "KARAN"
  return first === first.toUpperCase() && first.length > 1
    ? first[0] + first.slice(1).toLowerCase()
    : first;
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Lab / practical papers are their own subjects, even when the title starts the same as the lecture. */
const isLabName = (name: string) =>
  /\b(labs?|practicals?|workshops?)\b/i.test(name);

const isLabType = (type?: string) => /lab|practical/i.test(type ?? '');

const namesOverlap = (left: string, right: string) => {
  const a = slug(left);
  const b = slug(right);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
};

/** Whether a timetable slot is this subject's class, not its paired lab or lecture. */
export function slotBelongsToCourse(
  course: Pick<AttendanceCourse, 'courseCode' | 'courseName'>,
  slot: Pick<TimetableSlotItem, 'courseCode' | 'courseName'> &
    Partial<Pick<TimetableSlotItem, 'slotType'>>,
): boolean {
  if (slot.courseCode && slot.courseCode === course.courseCode) return true;
  if (slot.courseName && slug(slot.courseName) === slug(course.courseCode))
    return true;
  if (!namesOverlap(course.courseName, slot.courseName)) return false;
  const courseLab = isLabName(course.courseName);
  const slotTypedLab = isLabType(slot.slotType);
  const slotNamedLab = isLabName(slot.courseName);
  if (courseLab) return slotNamedLab || slotTypedLab;
  // Lecture paper: keep lab-typed classes out. A lecture still belongs here even if
  // the portal printed "Lab" in the title (that is what hid the planner).
  return !slotTypedLab;
}

/** Match a timetable slot to its attendance record by course code, falling back to the course name. */
export function findCourse(
  attendance: AttendanceCourse[],
  slot: Pick<TimetableSlotItem, 'courseCode' | 'courseName'> &
    Partial<Pick<TimetableSlotItem, 'slotType'>>,
): AttendanceCourse | undefined {
  if (slot.courseCode) {
    const byCode = attendance.find(c => c.courseCode === slot.courseCode);
    if (byCode) return byCode;
  }
  const matches = attendance.filter(c => slotBelongsToCourse(c, slot));
  if (matches.length <= 1) return matches[0];
  const name = slug(slot.courseName);
  return (
    matches.find(c => slug(c.courseName) === name) ??
    matches.find(
      c =>
        isLabName(c.courseName) ===
        (isLabName(slot.courseName) || isLabType(slot.slotType)),
    ) ??
    matches[0]
  );
}

// ------------------------------------------------------------- predictions

export const TARGETS = [65, 70, 75, 80, 85, 90] as const;

export type TargetPlan =
  | { kind: 'above'; canMiss: number }
  | { kind: 'below'; needToAttend: number }
  | { kind: 'impossible' }
  | { kind: 'empty' };

/** How many classes can be missed (or must be attended) to stay at / reach a target percentage. */
export function planForTarget(
  attended: number,
  delivered: number,
  target: number,
): TargetPlan {
  if (delivered <= 0) return { kind: 'empty' };
  if (attended * 100 >= target * delivered) {
    return {
      kind: 'above',
      canMiss: Math.max(0, Math.floor((attended * 100) / target - delivered)),
    };
  }
  if (target >= 100) return { kind: 'impossible' };
  return {
    kind: 'below',
    needToAttend: Math.ceil(
      (target * delivered - 100 * attended) / (100 - target),
    ),
  };
}

/** Projected percentage after attending `attend` more classes and missing `miss` more. */
export function simulate(
  attended: number,
  delivered: number,
  attend: number,
  miss: number,
): number {
  const total = delivered + attend + miss;
  if (total <= 0) return 100;
  return Math.round(((attended + attend) / total) * 1000) / 10;
}

// ------------------------------------------------------------------ history

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y ?? 1970, m: (m ?? 1) - 1, d: d ?? 1 };
};

/** "2026-10-20" to "Tue, 20 Oct" (no timezone shifts). */
export function dayLabel(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${DAY_NAMES[new Date(Date.UTC(y, m, d)).getUTCDay()]}, ${d} ${
    SHORT_MONTHS[m]
  }`;
}

export type MonthGroup = {
  key: string;
  label: string;
  entries: AttendanceHistoryEntry[];
  present: number;
  absent: number;
};

/** Newest month first; entries keep their newest-first order. */
export function monthGroups(history: AttendanceHistoryEntry[]): MonthGroup[] {
  const sorted = [...history].sort((a, b) =>
    a.date === b.date
      ? b.timing.localeCompare(a.timing)
      : b.date.localeCompare(a.date),
  );
  const groups = new Map<string, MonthGroup>();
  for (const entry of sorted) {
    const key = entry.date.slice(0, 7);
    const { y, m } = parts(entry.date);
    const group = groups.get(key) ?? {
      key,
      label: `${MONTH_NAMES[m]} ${y}`,
      entries: [],
      present: 0,
      absent: 0,
    };
    group.entries.push(entry);
    if (entry.status === 'PRESENT' || entry.status === 'DUTY_LEAVE')
      group.present += 1;
    if (entry.status === 'ABSENT') group.absent += 1;
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

export type HistoryStats = {
  present: number;
  absent: number;
  streak: number;
  lastAbsent: string | null;
  lastMarked: string | null;
};

export function historyStats(history: AttendanceHistoryEntry[]): HistoryStats {
  const sorted = [...history].sort((a, b) =>
    a.date === b.date
      ? b.timing.localeCompare(a.timing)
      : b.date.localeCompare(a.date),
  );
  let streak = 0;
  for (const entry of sorted) {
    if (entry.status === 'ABSENT') break;
    streak += 1;
  }
  return {
    present: history.filter(
      e => e.status === 'PRESENT' || e.status === 'DUTY_LEAVE',
    ).length,
    absent: history.filter(e => e.status === 'ABSENT').length,
    streak,
    lastAbsent: sorted.find(e => e.status === 'ABSENT')?.date ?? null,
    lastMarked: sorted[0]?.date ?? null,
  };
}

/** Running attendance percentage after each lecture, oldest to newest, thinned to at most `max` points. */
export function trendSeries(
  history: AttendanceHistoryEntry[],
  max = 60,
): number[] {
  if (history.length < 2) return [];
  const ordered = [...history].sort((a, b) =>
    a.date === b.date
      ? a.timing.localeCompare(b.timing)
      : a.date.localeCompare(b.date),
  );
  let attended = 0;
  const series = ordered.map((entry, index) => {
    if (entry.status !== 'ABSENT') attended += 1;
    return Math.round((attended / (index + 1)) * 1000) / 10;
  });
  if (series.length <= max) return series;
  const step = (series.length - 1) / (max - 1);
  return Array.from(
    { length: max },
    (_, i) => series[Math.round(i * step)] ?? 0,
  );
}

// ------------------------------------------------- timetable-driven planning

export type Session = { key: string; date: Date; slot: TimetableSlotItem };

const pad2 = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** The timetable slots that belong to one subject. */
export function slotsOfCourse(
  course: AttendanceCourse,
  timetable: TimetableSlotItem[],
): TimetableSlotItem[] {
  return timetable.filter(slot => slotBelongsToCourse(course, slot));
}

/**
 * Every class the timetable will hold over the next `days` days (Sundays have none). Today only counts classes that
 * have not started yet. This assumes each timetable class takes place; holidays are not known.
 */
export function upcomingSessions(
  slots: TimetableSlotItem[],
  from: Date,
  days: number,
): Session[] {
  const sessions: Session[] = [];
  const nowMinutes = from.getHours() * 60 + from.getMinutes();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate() + offset,
    );
    if (date.getDay() === 0) continue;
    for (const slot of slotsForDay(slots, date.getDay())) {
      if (offset === 0 && toMinutes(slot.startTime) <= nowMinutes) continue;
      sessions.push({
        key: `${dateKey(date)}|${slot.startTime}|${slot.id}`,
        date,
        slot,
      });
    }
  }
  return sessions;
}

export type PlanProjection = {
  finalPercent: number;
  lowest: number;
  running: number[];
};

/** `attend[i]` is whether session i is attended. Percentages are unrounded; round when showing. */
export function projectPlan(
  attended: number,
  delivered: number,
  attend: boolean[],
): PlanProjection {
  let a = attended;
  let d = delivered;
  const running: number[] = [];
  for (const yes of attend) {
    d += 1;
    if (yes) a += 1;
    running.push((a / d) * 100);
  }
  const current = delivered > 0 ? (attended / delivered) * 100 : 100;
  return {
    finalPercent: running.length
      ? running[running.length - 1] ?? current
      : current,
    lowest: running.length ? Math.min(...running) : current,
    running,
  };
}

/** How many of `count` upcoming classes can be skipped and still end at `target`% or more; null if even attending all falls short. */
export function maxSkippable(
  attended: number,
  delivered: number,
  count: number,
  target: number,
): number | null {
  const needed = Math.ceil((target / 100) * (delivered + count) - 1e-9);
  const mustAttend = Math.max(0, needed - attended);
  return mustAttend > count ? null : count - mustAttend;
}

/** Spreads `skips` skipped classes evenly through `count` classes; returns attend flags. */
export function spreadSkips(count: number, skips: number): boolean[] {
  const attend = Array<boolean>(count).fill(true);
  const n = Math.min(skips, count);
  for (let i = 0; i < n; i += 1)
    attend[Math.min(count - 1, Math.floor(((i + 0.5) * count) / n))] = false;
  return attend;
}

/** What missing every class of a day would do to each subject and to the overall percentage. */
export function bunkImpact(
  attendance: AttendanceCourse[],
  slots: TimetableSlotItem[],
) {
  const missed = new Map<string, number>();
  for (const slot of slots) {
    const course = findCourse(attendance, slot);
    if (course) missed.set(course.id, (missed.get(course.id) ?? 0) + 1);
  }
  let attendedTotal = 0;
  let deliveredTotal = 0;
  for (const c of attendance) {
    attendedTotal += c.attendedClasses;
    deliveredTotal += c.deliveredClasses;
  }
  const extra = Array.from(missed.values()).reduce((sum, n) => sum + n, 0);
  const before =
    deliveredTotal > 0 ? (attendedTotal / deliveredTotal) * 100 : 100;
  const after =
    deliveredTotal + extra > 0
      ? (attendedTotal / (deliveredTotal + extra)) * 100
      : 100;
  const falls = attendance
    .filter(c => missed.has(c.id))
    .map(c => ({
      course: c,
      after:
        (c.attendedClasses / (c.deliveredClasses + (missed.get(c.id) ?? 0))) *
        100,
    }))
    .filter(
      x =>
        x.after < x.course.minRequired &&
        x.course.percentage >= x.course.minRequired,
    );
  const alreadyShort = attendance.filter(
    c => missed.has(c.id) && c.percentage < c.minRequired,
  ).length;
  return { before, after, falls, alreadyShort, classes: extra };
}

const SUBJECT_COLORS = [
  '#3b9be8',
  '#a374ff',
  '#ff9f0a',
  '#34c759',
  '#ff6b9d',
  '#2dd4bf',
  '#facc15',
  '#f87171',
];

/** A stable colour per subject (by sorted course code) so the same subject looks the same everywhere. */
export function subjectColors(
  timetable: TimetableSlotItem[],
): Map<string, string> {
  const codes = Array.from(
    new Set(timetable.map(s => s.courseCode || s.courseName)),
  ).sort();
  return new Map(
    codes.map((code, index) => [
      code,
      SUBJECT_COLORS[index % SUBJECT_COLORS.length] ?? '#3b9be8',
    ]),
  );
}

export const slotKeyOf = (
  slot: Pick<TimetableSlotItem, 'courseCode' | 'courseName'>,
) => slot.courseCode || slot.courseName;

/** Day to open the timetable on: today if classes remain, else the next day that has any. */
export function defaultDay(
  timetable: TimetableSlotItem[],
  now: Date = new Date(),
): number {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (
    day !== 0 &&
    slotsForDay(timetable, day).some(s => toMinutes(s.endTime) > minutes)
  )
    return day;
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = (day + offset) % 7;
    if (next !== 0 && slotsForDay(timetable, next).length > 0) return next;
  }
  return day >= 1 && day <= 6 ? day : 1;
}

/** Calendar dates of this week's Monday to Saturday (Sunday looks ahead to the coming week). */
export function weekDates(now: Date = new Date()): Date[] {
  const day = now.getDay();
  const mondayOffset = day === 0 ? 1 : 1 - day;
  return Array.from(
    { length: 6 },
    (_, i) =>
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + mondayOffset + i,
      ),
  );
}

export const slotMinutes = (
  slot: Pick<TimetableSlotItem, 'startTime' | 'endTime'>,
) => toMinutes(slot.endTime) - toMinutes(slot.startTime);

export const durationLabel = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
    : `${minutes}m`;

// ------------------------------------------------ overall attendance prediction

export type FutureClass = Session & { course: AttendanceCourse };

/**
 * Every class between `from` and `until` (inclusive) that will actually run: the timetable, minus the days the
 * calendar says are holidays or breaks. Classes of subjects without an attendance record are left out.
 */
export function futureClasses(
  timetable: TimetableSlotItem[],
  attendance: AttendanceCourse[],
  from: Date,
  until: Date,
  nonTeaching: ReadonlySet<string>,
): FutureClass[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(until.getFullYear(), until.getMonth(), until.getDate());
  const days = Math.round((end.getTime() - start.getTime()) / 864e5) + 1;
  if (days <= 0) return [];
  const out: FutureClass[] = [];
  for (const session of upcomingSessions(timetable, from, days)) {
    if (nonTeaching.has(dateKey(session.date))) continue;
    const course = findCourse(attendance, session.slot);
    if (course) out.push({ ...session, course });
  }
  return out;
}

export type CoursePrediction = {
  course: AttendanceCourse;
  remaining: number;
  skipped: number;
  ifAttendAll: number;
  projected: number;
  /** How many of its remaining classes can be skipped and still end at the target; null if even attending all falls short. */
  canMiss: number | null;
};

export type OverallPrediction = {
  attended: number;
  delivered: number;
  current: number | null;
  remaining: number;
  skipped: number;
  ifAttendAll: number | null;
  projected: number | null;
  lowest: number | null;
  maxMissable: number | null;
  /** Attend flag for each class in `classes`, in the same order. */
  flags: boolean[];
  /** Overall percentage at the start and at the end of each week of the plan. */
  weekly: number[];
  perCourse: CoursePrediction[];
};

const ratio = (attended: number, delivered: number) =>
  delivered > 0 ? (attended / delivered) * 100 : 0;

const mondayKey = (date: Date) => {
  const back = (date.getDay() + 6) % 7;
  return dateKey(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - back),
  );
};

/**
 * Where overall attendance ends up if every class in `classes` is attended except the ones on `skipDays` and
 * `extraSkips` more spread evenly through the rest. Also reports the best case, the lowest point, how many
 * classes can be missed overall for `target`%, a week-by-week line and the same numbers per subject.
 */
export function predictOverall(
  attendance: AttendanceCourse[],
  classes: FutureClass[],
  options: { skipDays: number[]; extraSkips: number; target: number },
): OverallPrediction {
  const attended = attendance.reduce((s, c) => s + c.attendedClasses, 0);
  const delivered = attendance.reduce((s, c) => s + c.deliveredClasses, 0);
  const current = delivered > 0 ? ratio(attended, delivered) : null;

  const flags = classes.map(c => !options.skipDays.includes(c.date.getDay()));
  const free = flags.flatMap((yes, i) => (yes ? [i] : []));
  const extra = Math.max(0, Math.min(options.extraSkips, free.length));
  const spread = spreadSkips(free.length, extra);
  free.forEach((index, k) => {
    flags[index] = spread[k] ?? true;
  });

  const projection = projectPlan(attended, delivered, flags);
  const remaining = classes.length;
  const skipped = flags.filter(yes => !yes).length;
  const hasData = delivered > 0 || remaining > 0;

  const weekly: number[] = current === null ? [] : [current];
  let a = attended;
  let d = delivered;
  classes.forEach((c, i) => {
    d += 1;
    if (flags[i]) a += 1;
    const next = classes[i + 1];
    if (!next || mondayKey(next.date) !== mondayKey(c.date))
      weekly.push(ratio(a, d));
  });

  const perCourse = attendance
    .map<CoursePrediction>(course => {
      const mine = classes.flatMap((c, i) =>
        c.course.id === course.id ? [flags[i] ?? true] : [],
      );
      const attendedMore = mine.filter(Boolean).length;
      const total = course.deliveredClasses + mine.length;
      return {
        course,
        remaining: mine.length,
        skipped: mine.length - attendedMore,
        ifAttendAll: ratio(course.attendedClasses + mine.length, total),
        projected: ratio(course.attendedClasses + attendedMore, total),
        canMiss: maxSkippable(
          course.attendedClasses,
          course.deliveredClasses,
          mine.length,
          options.target,
        ),
      };
    })
    .sort((x, y) => x.projected - y.projected);

  return {
    attended,
    delivered,
    current,
    remaining,
    skipped,
    ifAttendAll: hasData
      ? ratio(attended + remaining, delivered + remaining)
      : null,
    projected: hasData ? projection.finalPercent : null,
    lowest: hasData ? projection.lowest : null,
    maxMissable: hasData
      ? maxSkippable(attended, delivered, remaining, options.target)
      : null,
    flags,
    weekly,
    perCourse,
  };
}

// ------------------------------------------------ teachers of a subject

export type Teacher = {
  name: string;
  /** "Lecture", "Lab", "Tutorial"… as the timetable lists them. */
  roles: string[];
  rooms: string[];
  /** Weekdays (0 = Sunday) the teacher takes this subject, Monday first. */
  days: number[];
  /** Timetable slots per week. */
  weekly: number;
};

const titleCase = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

const isRealName = (name: string | null | undefined): name is string =>
  !!name &&
  name.trim().length > 1 &&
  !/^(value\s*\d*|n\/?a|null|-+)$/i.test(name.trim());

/**
 * Everyone who teaches a subject: the faculty named in the attendance record plus whoever the timetable puts in
 * its slots, with what each one takes, where and on which days.
 */
export function teachersOfCourse(
  course: Pick<AttendanceCourse, 'facultyName'>,
  slots: TimetableSlotItem[],
): Teacher[] {
  const byKey = new Map<string, Teacher>();
  const keyOf = (name: string) =>
    name.trim().replace(/\s+/g, ' ').toLowerCase();
  const entry = (name: string) => {
    const key = keyOf(name);
    let teacher = byKey.get(key);
    if (!teacher) {
      teacher = {
        name: name.trim().replace(/\s+/g, ' '),
        roles: [],
        rooms: [],
        days: [],
        weekly: 0,
      };
      byKey.set(key, teacher);
    }
    return teacher;
  };
  for (const slot of slots) {
    if (!isRealName(slot.facultyName)) continue;
    const teacher = entry(slot.facultyName);
    const role = titleCase(slot.slotType || 'Lecture');
    if (!teacher.roles.includes(role)) teacher.roles.push(role);
    if (slot.room && !teacher.rooms.includes(slot.room))
      teacher.rooms.push(slot.room);
    if (!teacher.days.includes(slot.dayOfWeek))
      teacher.days.push(slot.dayOfWeek);
    teacher.weekly += 1;
  }
  if (isRealName(course.facultyName)) entry(course.facultyName);
  return [...byKey.values()]
    .map(t => ({
      ...t,
      days: [...t.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)),
    }))
    .sort((a, b) => b.weekly - a.weekly || a.name.localeCompare(b.name));
}
