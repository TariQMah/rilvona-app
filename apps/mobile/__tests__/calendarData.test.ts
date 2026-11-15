import {
  classifyActivity,
  cleanActivity,
  defaultCalendarVariant,
  expandRange,
  lastTeachingDay,
  nonTeachingDates,
  parseCalendarEvents,
  parseHolidays,
  upcomingHolidays,
  daysUntilIso,
  type AcademicCalendar,
  calendarDayMarks,
  itemsInMonth,
} from '../src/cuims/calendarData';

const table = (rows: string[][]) =>
  `<table><tr>${rows[0].map(c => `<th><p>${c}</p></th>`).join('')}</tr>${rows
    .slice(1)
    .map(r => `<tr>${r.map(c => `<td><p>${c}</p></td>`).join('')}</tr>`)
    .join('')}</table>`;

describe('holiday list', () => {
  const html = table([
    ['S.No.', 'Event', 'Date', 'Day'],
    ['1.', 'Republic Day', '26 January', 'Monday'],
    ['2', 'Dussehra', '20 October', 'Tuesday'],
    ['3', 'Christmas Day', '25 December', 'Friday'],
  ]);
  it('puts each date in the year where the weekday matches', () => {
    expect(parseHolidays(html, new Date(2026, 9, 20))).toEqual([
      { date: '2026-01-26', name: 'Republic Day' },
      { date: '2026-10-20', name: 'Dussehra' },
      { date: '2026-12-25', name: 'Christmas Day' },
    ]);
  });
  it('rolls into the next year when only that year matches', () => {
    // 26 January is a Tuesday in 2027
    const next = table([
      ['S', 'Event', 'Date', 'Day'],
      ['1', 'Republic Day', '26 January', 'Tuesday'],
    ]);
    expect(parseHolidays(next, new Date(2026, 9, 20))[0]?.date).toBe(
      '2027-01-26',
    );
  });
  it('ignores rows that are not holidays', () => {
    expect(parseHolidays('<table><tr><td>hello</td></tr></table>')).toEqual([]);
  });
});

describe('academic calendar', () => {
  const html = table([
    ['Date', 'Day', 'Activity'],
    [
      '09-11-2026',
      'Mon',
      'Diwali Break for Students [09.11.2026 to 11.11.2026]',
    ],
    [
      '13-11-2026',
      'Fri',
      'Last Teaching Day - All Years [All Programs, Except UID]',
    ],
    [
      '20-11-2026',
      'Fri',
      'Last Teaching Day &ndash; All Years [All Programs of UID]',
    ],
    [
      '12-10-2026',
      'Mon',
      'In Semester Test 2 [IST-2] All Years [All Programs] [12.10.2026 to 17.10.2026]',
    ],
    ['18-09-2026', 'Fri', 'Fresher&rsquo;s Party-2026 Intake [All Programs]'],
  ]);
  const events = parseCalendarEvents(html);

  it('reads dates, ranges and cleans the activity text', () => {
    expect(events.map(e => [e.date, e.endDate, e.kind])).toEqual([
      ['2026-09-18', undefined, 'event'],
      ['2026-10-12', '2026-10-17', 'exam'],
      ['2026-11-09', '2026-11-11', 'break'],
      ['2026-11-13', undefined, 'teaching-end'],
      ['2026-11-20', undefined, 'teaching-end'],
    ]);
    expect(events[0]?.title).toBe('Fresher’s Party-2026 Intake');
    expect(events[1]?.title).toBe('In Semester Test 2 [IST-2] All Years');
  });

  it('tells the two programme groups apart', () => {
    expect(events[3]?.title).toBe(
      'Last Teaching Day - All Years (other programs)',
    );
    expect(events[4]?.title).toBe(
      'Last Teaching Day – All Years (UID programs)',
    );
  });

  const calendar: AcademicCalendar = {
    variant: 'UIC',
    holidays: [
      { date: '2026-10-20', name: 'Dussehra' },
      { date: '2026-10-26', name: 'Valmiki Jayanti' },
    ],
    events,
    fetchedAt: '2026-10-20T00:00:00Z',
  };

  it('collects days without classes: holidays plus break ranges', () => {
    const off = nonTeachingDates(calendar);
    expect([...off].sort()).toEqual([
      '2026-10-20',
      '2026-10-26',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
  });

  it('finds the next last-teaching-day and upcoming holidays', () => {
    const now = new Date(2026, 9, 21);
    expect(lastTeachingDay(calendar, now)).toBe('2026-11-13');
    expect(lastTeachingDay(calendar, new Date(2026, 10, 14))).toBe(
      '2026-11-20',
    );
    expect(upcomingHolidays(calendar, now).map(h => h.name)).toEqual([
      'Valmiki Jayanti',
    ]);
    expect(daysUntilIso('2026-10-26', now)).toBe(5);
    expect(daysUntilIso('2026-10-21', now)).toBe(0);
  });
});

describe('helpers', () => {
  it('classifies activities', () => {
    expect(classifyActivity('Start of Odd Semester- Old Batches')).toBe(
      'term-start',
    );
    expect(classifyActivity('End of Even Semester All Years')).toBe('term-end');
    expect(classifyActivity('Start of Registration for Even Semester')).toBe(
      'event',
    );
    expect(classifyActivity('End Semester Theory Exams-Regular')).toBe('exam');
    expect(classifyActivity('Innovfest')).toBe('event');
  });
  it('cleans bracketed noise and caps ranges', () => {
    expect(cleanActivity('Winter Term 2026 [15.12.2026 to 28.12.2026]*')).toBe(
      'Winter Term 2026',
    );
    expect(expandRange('2026-11-30', '2026-12-02')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
    expect(expandRange('2026-01-01', '2030-01-01').length).toBe(62);
  });
  it('picks the Institute of Computing calendar for BCA / MCA students', () => {
    expect(defaultCalendarVariant({ program: 'MCA (AI & ML)' })).toBe('UIC');
    expect(
      defaultCalendarVariant({ studentUid: '26MCI10238', section: '26MAM-4' }),
    ).toBe('UIC');
    expect(
      defaultCalendarVariant({ studentUid: '23BCS10452', program: 'B.E. CSE' }),
    ).toBe('GENERAL');
  });
});

describe('month grid helpers', () => {
  const calendar = {
    variant: 'UIC' as const,
    fetchedAt: '2026-10-20T00:00:00.000Z',
    holidays: [{ date: '2026-11-08', name: 'Diwali' }],
    events: [
      {
        date: '2026-11-07',
        endDate: '2026-11-10',
        title: 'Diwali Break',
        kind: 'break' as const,
      },
      {
        date: '2026-11-23',
        endDate: '2026-11-25',
        title: 'Theory exams',
        kind: 'exam' as const,
      },
      {
        date: '2026-12-19',
        title: 'End of Odd Semester',
        kind: 'term-end' as const,
      },
    ],
  };

  it('marks days and lets a holiday win over a break', () => {
    const marks = calendarDayMarks(calendar);
    expect(marks.get('2026-11-07')).toBe('break');
    expect(marks.get('2026-11-08')).toBe('holiday');
    expect(marks.get('2026-11-24')).toBe('exam');
    expect(marks.get('2026-12-19')).toBe('event');
    expect(marks.get('2026-11-01')).toBeUndefined();
  });

  it('lists what touches a month, including ranges that start earlier', () => {
    expect(itemsInMonth(calendar, 2026, 11).map(i => i.title)).toEqual([
      'Diwali Break',
      'Diwali',
      'Theory exams',
    ]);
    expect(itemsInMonth(calendar, 2026, 12).map(i => i.title)).toEqual([
      'End of Odd Semester',
    ]);
    expect(itemsInMonth(calendar, 2026, 10)).toEqual([]);
  });
});
