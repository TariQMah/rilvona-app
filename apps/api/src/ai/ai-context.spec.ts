import { buildAiContext, OverviewLike } from './ai-context';

const overview: OverviewLike = {
  connected: true,
  connection: {
    studentName: 'Karan Dixit',
    program: 'B.E. CSE',
    semester: 5,
    section: '26MAM-2',
    mentor: { name: 'Rajan Saluja' },
    // Fields that must never be forwarded.
    ...({ studentUid: '26MAM1234', photo: 'data:image/png;base64,AAAA' } as object),
  },
  attendance: [
    {
      courseCode: 'CSE-101',
      courseName: 'Python Programming',
      facultyName: 'Ajay Yadav',
      attendedClasses: 41,
      deliveredClasses: 50,
      dutyLeave: 0,
      percentage: 82,
      minRequired: 75,
      lastLectureAt: new Date('2026-10-20T04:30:00Z'),
      history: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${(i % 28) + 1}`, timing: '9:55', status: 'PRESENT' })),
    },
  ],
  timetable: [],
  marks: [],
  alerts: [{ category: 'EXAM', courseCode: null, title: 'Lab exam', body: 'x'.repeat(900), publishedAt: new Date('2026-10-19T00:00:00Z') }],
  notices: [],
};

describe('buildAiContext', () => {
  it('keeps what the assistant needs and drops identifiers', () => {
    const context = buildAiContext(overview, { clientTime: '2026-10-20T22:30:00.000Z', timezone: 'Asia/Kolkata' });
    expect(context.now).toBe('2026-10-20T22:30:00.000Z');
    expect(context.student).toEqual({ name: 'Karan Dixit', program: 'B.E. CSE', semester: 5, section: '26MAM-2', mentor: 'Rajan Saluja' });
    expect(JSON.stringify(context)).not.toContain('26MAM1234');
    expect(JSON.stringify(context)).not.toContain('base64');
    expect(context.attendance[0]!.lastLectureAt).toBe('2026-10-20T04:30:00.000Z');
  });

  it('trims long history and alert text, and falls back to the server clock', () => {
    const context = buildAiContext(overview, { now: new Date('2026-10-21T00:00:00Z') });
    expect(context.attendance[0]!.history).toHaveLength(10);
    expect(context.alerts[0]!.body).toHaveLength(400);
    expect(context.now).toBe('2026-10-21T00:00:00.000Z');
    expect(context.timezone).toBe('Asia/Kolkata');
  });
});
