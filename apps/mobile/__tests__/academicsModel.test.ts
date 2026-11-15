import type {
  AttendanceCourse,
  AttendanceHistoryEntry,
  CourseMarkItem,
  TimetableSlotItem,
} from '../src/api/types';
import {
  averagePercent,
  classStatus,
  clock12,
  dayCounts,
  findCourse,
  slotsOfCourse,
  planForTarget,
  simulate,
  dayLabel,
  monthGroups,
  nextDayClass,
  upcomingSessions,
  projectPlan,
  maxSkippable,
  spreadSkips,
  bunkImpact,
  defaultDay,
  subjectColors,
  weekDates,
  durationLabel,
  realMentor,
  historyStats,
  trendSeries,
  radarLabel,
  greeting,
  groupMarks,
  guidanceText,
  percentIfAttend,
  percentIfSkip,
  shortName,
  toneOf,
  markPercent,
  sortAssessments,
  marksKinds,
  filterMarks,
  kindBreakdown,
  marksInsights,
  marksTone,
  futureClasses,
  teachersOfCourse,
  predictOverall,
} from '../src/screens/academics/model';

const slot = (
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  code = 'C1',
): TimetableSlotItem => ({
  id: `${dayOfWeek}${startTime}`,
  dayOfWeek,
  startTime,
  endTime,
  courseCode: code,
  courseName: code,
  room: 'R',
  facultyName: null,
  slotType: 'LECTURE',
  section: null,
});

// Tuesday 20 Oct 2026
const at = (h: number, m: number) => new Date(2026, 9, 20, h, m);

describe('academics model', () => {
  const timetable = [
    slot(2, '09:30', '10:20'),
    slot(2, '13:40', '14:25'),
    slot(2, '11:00', '11:45'),
    slot(3, '09:00', '09:50'),
  ];

  it('finds the live class and minutes left', () => {
    const status = classStatus(timetable, at(11, 20));
    expect(status).toMatchObject({ kind: 'live', minutesLeft: 25 });
  });

  it('finds the next class between lectures', () => {
    const status = classStatus(timetable, at(12, 0));
    expect(status).toMatchObject({ kind: 'next', minutesUntil: 100 });
    if (status.kind === 'next') expect(status.slot.startTime).toBe('13:40');
  });

  it('reports none after the last class and on Sunday', () => {
    expect(classStatus(timetable, at(18, 0)).kind).toBe('none');
    expect(classStatus(timetable, new Date(2026, 9, 18, 10, 0)).kind).toBe(
      'none',
    );
  });

  it('counts classes per day', () => {
    expect(dayCounts(timetable)).toEqual({ 2: 3, 3: 1 });
  });

  it('computes attend and skip percentages', () => {
    const c = { attendedClasses: 30, deliveredClasses: 33 };
    expect(percentIfAttend(c)).toBe(91.2);
    expect(percentIfSkip(c)).toBe(88.2);
  });

  it('phrases attendance guidance', () => {
    const base = {
      guidance: { status: 'SAFE', canMiss: 7, needToAttend: 0, label: '' },
    } as AttendanceCourse;
    expect(guidanceText(base)).toBe('Safe to miss 7 classes');
    expect(toneOf(base)).toBe('safe');
    const short = {
      guidance: { status: 'SHORTAGE', canMiss: 0, needToAttend: 1, label: '' },
    } as AttendanceCourse;
    expect(guidanceText(short)).toBe('Attend next 1 class');
    expect(toneOf(short)).toBe('short');
  });

  it('groups marks and ignores unknown maximums in percentages', () => {
    const mark = (
      code: string,
      name: string,
      o: number,
      m: number,
    ): CourseMarkItem => ({
      id: code + name,
      semester: 1,
      courseCode: code,
      courseName: code,
      assessmentName: name,
      category: 'THEORY',
      obtainedMarks: o,
      maxMarks: m,
      weightage: null,
      publishedAt: '2026-10-01T00:00:00Z',
    });
    const groups = groupMarks([
      mark('A', 'MST', 18, 20),
      mark('A', 'Quiz', 5, 0),
      mark('B', 'MST', 10, 20),
    ]);
    expect(groups.find(g => g.courseCode === 'A')).toMatchObject({
      percent: 90,
      obtained: 18,
      max: 20,
    });
    expect(averagePercent(groups)).toBe(70);
    expect(averagePercent([])).toBeNull();
  });

  it('formats names and times', () => {
    expect(shortName('Mathematical Foundations')).toBe('Mathemat..');
    expect(shortName('Python')).toBe('Python');
    expect(clock12('13:40')).toBe('1:40 PM');
    expect(clock12('00:05')).toBe('12:05 AM');
    expect(greeting(at(9, 0))).toBe('Good Morning');
    expect(greeting(at(14, 0))).toBe('Good Afternoon');
    expect(greeting(at(20, 0))).toBe('Good Evening');
  });

  it('matches a slot to attendance by code, then by name', () => {
    const courses = [
      { courseCode: 'OPERATING-SYSTEMS', courseName: 'Operating Systems' },
      { courseCode: 'X1', courseName: 'Networks' },
    ] as AttendanceCourse[];
    expect(
      findCourse(courses, { courseCode: 'X1', courseName: 'zzz' })?.courseName,
    ).toBe('Networks');
    expect(
      findCourse(courses, {
        courseCode: 'CSB-1',
        courseName: 'operating systems',
      })?.courseCode,
    ).toBe('OPERATING-SYSTEMS');
    expect(
      findCourse(courses, { courseCode: 'Q', courseName: 'Chemistry' }),
    ).toBeUndefined();
  });

  it('keeps a lecture and its lab as two subjects', () => {
    const lecture = {
      id: 'lec',
      courseCode: '26CAT-611',
      courseName: 'Design and Analysis of Algorithms',
    } as AttendanceCourse;
    const lab = {
      id: 'lab',
      courseCode: '26CAP-612',
      courseName: 'Design and Analysis of Algorithms Lab',
    } as AttendanceCourse;
    const courses = [lab, lecture];
    expect(
      findCourse(courses, {
        courseCode: 'DESIGN-AND-ANALYSIS-OF-A',
        courseName: 'Design and Analysis of Algorithms',
      })?.id,
    ).toBe('lec');
    expect(
      findCourse(courses, {
        courseCode: 'DESIGN-AND-ANALYSIS-OF-A',
        courseName: 'Design and Analysis of Algorithms Lab',
      })?.id,
    ).toBe('lab');
    expect(
      slotsOfCourse(lecture, [
        {
          id: '1',
          courseCode: '',
          courseName: 'Design and Analysis of Algorithms',
          slotType: 'LECTURE',
        } as TimetableSlotItem,
        {
          id: '2',
          courseCode: '',
          courseName: 'Design and Analysis of Algorithms Lab',
          slotType: 'LAB',
        } as TimetableSlotItem,
        {
          id: '3',
          courseCode: '',
          courseName: 'Design and Analysis of Algorithms Lab',
          slotType: 'LECTURE',
        } as TimetableSlotItem,
      ]).map(s => s.id),
    ).toEqual(['1', '3']);
    expect(
      slotsOfCourse(lab, [
        {
          id: '1',
          courseCode: '',
          courseName: 'Design and Analysis of Algorithms',
          slotType: 'LECTURE',
        } as TimetableSlotItem,
        {
          id: '2',
          courseCode: '',
          courseName: 'Design and Analysis of Algorithms Lab',
          slotType: 'LAB',
        } as TimetableSlotItem,
      ]).map(s => s.id),
    ).toEqual(['2']);
  });

  it('plans how many classes can be missed or must be attended', () => {
    expect(planForTarget(35, 41, 75)).toEqual({ kind: 'above', canMiss: 5 });
    expect(planForTarget(27, 38, 75)).toEqual({
      kind: 'below',
      needToAttend: 6,
    });
    expect(planForTarget(0, 0, 75)).toEqual({ kind: 'empty' });
    expect(planForTarget(9, 10, 100)).toEqual({ kind: 'impossible' });
    expect(planForTarget(10, 10, 100)).toEqual({ kind: 'above', canMiss: 0 });
  });

  it('simulates attending and missing future classes', () => {
    expect(simulate(30, 40, 0, 0)).toBe(75);
    expect(simulate(30, 40, 4, 0)).toBe(77.3);
    expect(simulate(30, 40, 0, 4)).toBe(68.2);
  });

  it('summarises history', () => {
    const history = [
      { date: '2026-10-01', timing: '09:00', status: 'PRESENT' },
      { date: '2026-10-02', timing: '09:00', status: 'ABSENT' },
      { date: '2026-10-05', timing: '09:00', status: 'PRESENT' },
      { date: '2026-09-28', timing: '09:00', status: 'PRESENT' },
    ] as AttendanceHistoryEntry[];
    const groups = monthGroups(history);
    expect(groups.map(g => g.label)).toEqual([
      'October 2026',
      'September 2026',
    ]);
    expect(groups[0]).toMatchObject({ present: 2, absent: 1 });
    expect(groups[0]?.entries[0]?.date).toBe('2026-10-05');
    expect(historyStats(history)).toMatchObject({
      present: 3,
      absent: 1,
      streak: 1,
      lastAbsent: '2026-10-02',
      lastMarked: '2026-10-05',
    });
    expect(trendSeries(history)).toEqual([100, 100, 66.7, 75]);
    expect(trendSeries(history.slice(0, 1))).toEqual([]);
    expect(dayLabel('2026-10-20')).toBe('Tue, 20 Oct');
  });

  it('builds distinguishable radar labels', () => {
    expect(radarLabel('Design and Analysis of Algorithms')).toBe('DAA');
    expect(radarLabel('Design and Analysis of Algorithms Lab')).toBe('DAA Lab');
    expect(radarLabel('Advanced Internet Programming')).toBe('AIP');
    expect(radarLabel('Python Programming')).toBe('Python');
    expect(radarLabel('PL/SQL Lab')).toBe('PL/SQL Lab');
  });
});

describe('dashboard helpers', () => {
  it('finds the next day with classes, skipping Sunday', () => {
    const table = [
      slot(1, '09:40', '10:20', 'MON'),
      slot(3, '11:00', '11:40', 'WED'),
    ];
    // Tuesday 20 Oct 2026 -> Wednesday is tomorrow
    expect(nextDayClass(table, new Date(2026, 9, 20, 16, 0))?.dayName).toBe(
      'Tomorrow',
    );
    // Saturday 24 Oct -> Sunday skipped, Monday is 2 days away
    expect(nextDayClass(table, new Date(2026, 9, 24, 12, 0))).toMatchObject({
      dayName: 'Monday',
    });
    expect(nextDayClass([], new Date())).toBeNull();
  });

  it('treats the mentor API template values as no mentor', () => {
    expect(
      realMentor({ name: 'value1', lines: ['value1', 'value2'] }),
    ).toBeNull();
    expect(realMentor({ name: 'Dr. A', lines: ['Dr. A', 'value2'] })).toEqual({
      name: 'Dr. A',
      lines: ['Dr. A'],
    });
    expect(realMentor(null)).toBeNull();
  });
});

describe('timetable planning', () => {
  const mk = (
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    code: string,
    name = 'Subject',
  ): TimetableSlotItem => ({
    ...slot(dayOfWeek, startTime, endTime, code),
    courseName: name,
  });
  const course = (over: Partial<AttendanceCourse> = {}): AttendanceCourse =>
    ({
      id: 'c1',
      courseCode: 'C1',
      courseName: 'Subject',
      attendedClasses: 18,
      deliveredClasses: 24,
      percentage: 75,
      minRequired: 75,
      ...over,
    } as AttendanceCourse);

  it('lists upcoming classes, skipping Sundays and classes that already started today', () => {
    const table = [
      mk(2, '09:40', '10:20', 'C1'),
      mk(2, '14:00', '14:40', 'C1'),
      mk(3, '10:00', '10:40', 'C1'),
    ];
    // Tuesday 20 Oct 2026, 12:00
    const list = upcomingSessions(table, new Date(2026, 9, 20, 12, 0), 7);
    expect(list.map(s => `${s.date.getDate()} ${s.slot.startTime}`)).toEqual([
      '20 14:00',
      '21 10:00',
    ]);
  });

  it('projects a plan and finds how many classes can be skipped', () => {
    const p = projectPlan(18, 24, [true, false, false]);
    expect(Math.round(p.finalPercent * 10) / 10).toBe(70.4);
    expect(p.running).toHaveLength(3);
    // 18/24 = 75%. Over 4 more classes at 75%: need ceil(0.75*28)=21 attended -> must attend 3 of 4 -> can skip 1
    expect(maxSkippable(18, 24, 4, 75)).toBe(1);
    expect(maxSkippable(10, 24, 2, 75)).toBeNull();
    expect(maxSkippable(24, 24, 3, 75)).toBe(3);
  });

  it('spreads skips evenly through the plan', () => {
    expect(spreadSkips(6, 2)).toEqual([true, false, true, true, false, true]);
    expect(spreadSkips(3, 0)).toEqual([true, true, true]);
    expect(spreadSkips(2, 5).filter(x => !x)).toHaveLength(2);
  });

  it('works out what a skipped day does', () => {
    const a = course({
      id: 'a',
      courseCode: 'A',
      attendedClasses: 15,
      deliveredClasses: 20,
      percentage: 75,
    });
    const b = course({
      id: 'b',
      courseCode: 'B',
      attendedClasses: 19,
      deliveredClasses: 20,
      percentage: 95,
    });
    const impact = bunkImpact(
      [a, b],
      [mk(1, '09:00', '09:40', 'A'), mk(1, '10:00', '10:40', 'B')],
    );
    expect(impact.classes).toBe(2);
    expect(impact.before).toBeCloseTo(85, 5);
    expect(impact.after).toBeCloseTo((34 / 42) * 100, 5);
    expect(impact.falls.map(f => f.course.id)).toEqual(['a']);
  });

  it('opens on today while classes remain, else on the next class day', () => {
    const table = [
      mk(2, '09:40', '10:20', 'C1'),
      mk(3, '10:00', '10:40', 'C1'),
    ];
    expect(defaultDay(table, new Date(2026, 9, 20, 8, 0))).toBe(2);
    expect(defaultDay(table, new Date(2026, 9, 20, 16, 0))).toBe(3);
    expect(defaultDay(table, new Date(2026, 9, 25, 10, 0))).toBe(2);
  });

  it('gives each subject a stable colour and builds the week', () => {
    const colors = subjectColors([
      mk(1, '09:00', '09:40', 'B'),
      mk(1, '10:00', '10:40', 'A'),
    ]);
    expect(colors.get('A')).not.toBe(colors.get('B'));
    const week = weekDates(new Date(2026, 9, 20));
    expect(week.map(d => d.getDate())).toEqual([19, 20, 21, 22, 23, 24]);
    expect(durationLabel(100)).toBe('1h 40m');
  });
});

describe('marks analysis', () => {
  const m = (
    code: string,
    name: string,
    category: string,
    o: number,
    max: number,
  ): CourseMarkItem => ({
    id: `${code}${name}`,
    semester: 1,
    courseCode: code,
    courseName: `Course ${code}`,
    assessmentName: name,
    category,
    obtainedMarks: o,
    maxMarks: max,
    weightage: null,
    publishedAt: '2026-10-01T00:00:00Z',
  });
  const marks = [
    m('A', 'Practical Worksheet 10', 'PRACTICAL', 20, 30),
    m('A', 'Practical Worksheet 2', 'PRACTICAL', 0, 30),
    m('A', 'MST-1', 'THEORY', 12, 20),
    m('B', 'MST-1', 'THEORY', 19, 20),
    m('B', 'Quiz', 'INTERNAL', 5, 0),
  ];

  it('scores single assessments', () => {
    expect(markPercent(marks[0])).toBe(66.7);
    expect(markPercent(marks[4])).toBeNull();
  });

  it('sorts theory first and numbers naturally', () => {
    expect(
      sortAssessments(marks.slice(0, 3)).map(x => x.assessmentName),
    ).toEqual(['MST-1', 'Practical Worksheet 2', 'Practical Worksheet 10']);
  });

  it('lists and filters kinds', () => {
    expect(marksKinds(marks)).toEqual(['THEORY', 'INTERNAL', 'PRACTICAL']);
    expect(filterMarks(marks, 'THEORY')).toHaveLength(2);
    expect(filterMarks(marks, 'ALL')).toHaveLength(5);
  });

  it('breaks a subject down by kind, ignoring unknown maxima', () => {
    const a = marks.filter(x => x.courseCode === 'A');
    expect(kindBreakdown(a)).toEqual([
      { kind: 'THEORY', obtained: 12, max: 20, percent: 60, count: 1 },
      { kind: 'PRACTICAL', obtained: 20, max: 60, percent: 33.3, count: 2 },
    ]);
  });

  it('finds best, lowest and weak assessments', () => {
    const ins = marksInsights(groupMarks(marks));
    expect(ins.best?.courseCode).toBe('B');
    expect(ins.lowest?.courseCode).toBe('A');
    expect(ins.weak.map(w => w.assessmentName)).toEqual([
      'Practical Worksheet 2',
    ]);
    expect(ins.weak[0].percent).toBe(0);
    expect(ins.obtained).toBe(51);
    expect(ins.max).toBe(100);
  });

  it('has no lowest with a single subject and tones by threshold', () => {
    expect(marksInsights(groupMarks(marks.slice(3))).lowest).toBeNull();
    expect(marksTone(80)).toBe('safe');
    expect(marksTone(60)).toBe('edge');
    expect(marksTone(20)).toBe('short');
    expect(marksTone(null)).toBe('none');
  });
});

describe('overall prediction', () => {
  const course = (
    id: string,
    code: string,
    attended: number,
    delivered: number,
  ): AttendanceCourse =>
    ({
      id,
      courseCode: code,
      courseName: `Course ${code}`,
      attendedClasses: attended,
      deliveredClasses: delivered,
      percentage: (attended / delivered) * 100,
    } as AttendanceCourse);
  const attendance = [course('1', 'A', 8, 10), course('2', 'B', 9, 10)];
  // Monday and Tuesday, one class each, one subject per day.
  const timetable = [
    slot(1, '09:00', '09:45', 'A'),
    slot(2, '09:00', '09:45', 'B'),
  ];
  const from = new Date(2026, 9, 19, 7, 0); // Monday 19 Oct 2026, before class
  const until = new Date(2026, 9, 30); // Friday 30 Oct => Mon/Tue of two weeks

  it('lists the classes that will run and drops holidays', () => {
    expect(
      futureClasses(timetable, attendance, from, until, new Set()).length,
    ).toBe(4);
    const off = new Set(['2026-10-26']);
    const classes = futureClasses(timetable, attendance, from, until, off);
    expect(classes.map(c => c.key.slice(0, 10))).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-27',
    ]);
  });

  it('projects attending everything', () => {
    const classes = futureClasses(
      timetable,
      attendance,
      from,
      until,
      new Set(),
    );
    const p = predictOverall(attendance, classes, {
      skipDays: [],
      extraSkips: 0,
      target: 75,
    });
    expect(p.current).toBe(85);
    expect(p.remaining).toBe(4);
    expect(p.projected).toBeCloseTo(((17 + 4) / 24) * 100, 5);
    expect(p.ifAttendAll).toBeCloseTo((21 / 24) * 100, 5);
    expect(p.skipped).toBe(0);
  });

  it('skips whole weekdays and extra classes', () => {
    const classes = futureClasses(
      timetable,
      attendance,
      from,
      until,
      new Set(),
    );
    const p = predictOverall(attendance, classes, {
      skipDays: [1],
      extraSkips: 1,
      target: 75,
    });
    // two Mondays skipped, plus one of the remaining two Tuesdays
    expect(p.skipped).toBe(3);
    expect(p.projected).toBeCloseTo(((17 + 1) / 24) * 100, 5);
    expect(p.lowest).toBeLessThanOrEqual(p.projected as number);
  });

  it('finds how many can be missed overall and per subject', () => {
    const classes = futureClasses(
      timetable,
      attendance,
      from,
      until,
      new Set(),
    );
    const p = predictOverall(attendance, classes, {
      skipDays: [],
      extraSkips: 0,
      target: 75,
    });
    // 24 classes in total, 18 must be attended, 17 already attended => attend 1 of the 4, miss 3
    expect(p.maxMissable).toBe(3);
    const a = p.perCourse.find(c => c.course.id === '1');
    expect(a?.remaining).toBe(2);
    expect(a?.canMiss).toBe(1); // 12 in total, 9 needed, 8 attended: attend one, miss one
  });

  it('builds a week by week line starting at the current value', () => {
    const classes = futureClasses(
      timetable,
      attendance,
      from,
      until,
      new Set(),
    );
    const p = predictOverall(attendance, classes, {
      skipDays: [],
      extraSkips: 0,
      target: 75,
    });
    expect(p.weekly.length).toBe(3); // start + two weeks
    expect(p.weekly[0]).toBe(85);
  });

  it('copes with no data', () => {
    const p = predictOverall([], [], {
      skipDays: [],
      extraSkips: 0,
      target: 75,
    });
    expect(p.current).toBeNull();
    expect(p.projected).toBeNull();
    expect(p.maxMissable).toBeNull();
  });
});

describe('teachers of a subject', () => {
  const lecture = (
    day: number,
    teacher: string | null,
    room: string,
    type = 'LECTURE',
  ) =>
    ({
      id: `${day}${type}`,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '09:45',
      courseCode: 'A',
      courseName: 'Course A',
      room,
      facultyName: teacher,
      slotType: type,
    } as TimetableSlotItem);

  it('combines timetable and attendance faculty with roles, rooms and days', () => {
    const teachers = teachersOfCourse({ facultyName: 'Dr Ann Lee' }, [
      lecture(3, 'Dr Ann Lee', 'E1-101'),
      lecture(1, 'dr ann  lee', 'E1-101'),
      lecture(5, 'Bob Rao', 'Lab 4', 'LAB'),
      lecture(2, null, 'E1-101'),
    ]);
    expect(teachers.map(t => t.name)).toEqual(['Dr Ann Lee', 'Bob Rao']);
    expect(teachers[0]).toMatchObject({
      roles: ['Lecture'],
      rooms: ['E1-101'],
      days: [1, 3],
      weekly: 2,
    });
    expect(teachers[1]).toMatchObject({
      roles: ['Lab'],
      rooms: ['Lab 4'],
      days: [5],
      weekly: 1,
    });
  });

  it('falls back to the attendance faculty and ignores template values', () => {
    expect(teachersOfCourse({ facultyName: 'Dr Zed' }, [])).toEqual([
      { name: 'Dr Zed', roles: [], rooms: [], days: [], weekly: 0 },
    ]);
    expect(
      teachersOfCourse({ facultyName: 'value1' }, [lecture(1, 'N/A', 'R')]),
    ).toEqual([]);
  });
});
