import {
  datesheetColumns,
  datesheetPathFromMenu,
  daysToExam,
  htmlFromPageMethod,
  nextExam,
  parseDatesheet,
  parseExamDate,
  parseExamTime,
  sheetsOf,
} from '../src/cuims/datesheetData';

const HEADERS = [
  'Exam Type',
  'datesheettype',
  'Course code',
  'Course Name',
  'SlotNo',
  'UID',
  'New SlotNo',
  'Exam Date',
  'Exam Timing',
  'Exam Venue',
  'Mode OF Exam',
  'Error Reporting',
];

const cells = (row: string[]) => row.map(c => `<td>${c}</td>`).join('');
const page = (rows: string[][], headers = HEADERS) =>
  `<html><table><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>${rows
    .map(r => `<tr>${cells(r)}</tr>`)
    .join('')}</table></html>`;

const row = (
  sheet: string,
  code: string,
  name: string,
  date: string,
  time: string,
  venue = 'E1',
) => [
  'Regular',
  sheet,
  code,
  name,
  '12',
  '26MCI10238',
  '',
  date,
  time,
  venue,
  'Offline',
  '',
];

describe('date sheet parsing', () => {
  it('reads the usual date formats', () => {
    expect(parseExamDate('20 Oct 2026')).toBe('2026-10-20');
    expect(parseExamDate('Tue, 5 November 2026')).toBe('2026-11-05');
    expect(parseExamDate('20/10/2026')).toBe('2026-10-20');
    expect(parseExamDate('5-1-2027')).toBe('2027-01-05');
    expect(parseExamDate('2026-10-20')).toBe('2026-10-20');
    expect(parseExamDate('soon')).toBeNull();
  });

  it('reads times, including 12-hour and ranges', () => {
    expect(parseExamTime('09:00')).toBe('09:00');
    expect(parseExamTime('9:30 AM')).toBe('09:30');
    expect(parseExamTime('1.30 PM')).toBe('13:30');
    expect(parseExamTime('12:00 AM')).toBe('00:00');
    expect(parseExamTime('10:00 - 12:00')).toBe('10:00');
    expect(parseExamTime('')).toBe('');
  });

  it('maps the columns by header and ignores the personal ones', () => {
    expect(datesheetColumns(HEADERS)).toEqual({
      examType: 0,
      sheet: 1,
      courseCode: 2,
      courseName: 3,
      slot: 4,
      date: 7,
      time: 8,
      venue: 9,
      mode: 10,
    });
  });

  it('parses exams in date order without the UID', () => {
    const html = page([
      row(
        'MST-2',
        '26CAH-614',
        'Advanced Internet Programming',
        '28 Oct 2026',
        '14:00',
      ),
      row(
        'MST-1',
        '26CAH-606',
        'Python Programming',
        '22 Sep 2026',
        '09:00',
        'B9',
      ),
      row('MST-2', '26CAH-606', 'Python Programming', '27 Oct 2026', '09:00'),
    ]);
    const exams = parseDatesheet(html);
    expect(exams.map(e => [e.sheet, e.date, e.time])).toEqual([
      ['MST-1', '2026-09-22', '09:00'],
      ['MST-2', '2026-10-27', '09:00'],
      ['MST-2', '2026-10-28', '14:00'],
    ]);
    expect(exams[0]).toMatchObject({
      courseCode: '26CAH-606',
      venue: 'B9',
      mode: 'Offline',
      kind: 'theory',
    });
    expect(JSON.stringify(exams)).not.toContain('26MCI10238');
  });

  it('ignores tables that are not a date sheet and rows without a date', () => {
    expect(
      parseDatesheet(
        '<table><tr><th>Name</th><th>Marks</th></tr><tr><td>A</td><td>5</td></tr></table>',
      ),
    ).toEqual([]);
    expect(
      parseDatesheet(page([row('MST-1', 'X', 'Subject', 'TBA', '09:00')])),
    ).toEqual([]);
    expect(parseDatesheet('<html>no tables</html>')).toEqual([]);
  });

  it('labels a practical sheet that has no sheet column', () => {
    const html = page(
      [['26CAH-606', 'Python Lab', '12 Nov 2026', '10:00']],
      ['Course Code', 'Course Name', 'Date', 'Time'],
    );
    expect(parseDatesheet(html, 'practical')[0]).toMatchObject({
      sheet: 'Practical',
      kind: 'practical',
      time: '10:00',
    });
  });

  it('reads the date sheet href out of the portal menu search', () => {
    const html = htmlFromPageMethod(
      JSON.stringify({
        d: `<ol><li><a href='frmStudentDatesheet.aspx?type=abc=='>My Date Sheet</a></li>
            <li><a href='frmStudentPracticleDateSheet.aspx'>Practical</a></li></ol>`,
      }),
    );
    expect(html).toContain('My Date Sheet');
    expect(datesheetPathFromMenu(html ?? '', 'theory')).toBe(
      'frmStudentDatesheet.aspx?type=abc==',
    );
    expect(datesheetPathFromMenu(html ?? '', 'practical')).toBe(
      'frmStudentPracticleDateSheet.aspx',
    );
    expect(datesheetPathFromMenu('<p>none</p>', 'theory')).toBeNull();
  });

  it('counts days, finds the next exam and orders the sheets', () => {
    const now = new Date(2026, 9, 20, 15, 0);
    expect(daysToExam('2026-10-20', now)).toBe(0);
    expect(daysToExam('2026-10-27', now)).toBe(7);
    expect(daysToExam('2026-10-19', now)).toBe(-1);
    const exams = parseDatesheet(
      page([
        row('MST-2', 'B', 'Later', '27 Oct 2026', '09:00'),
        row('MST-1', 'A', 'Earlier', '22 Sep 2026', '09:00'),
      ]),
    );
    expect(nextExam(exams, now)?.courseName).toBe('Later');
    expect(nextExam(exams, new Date(2026, 10, 1))).toBeNull();
    expect(
      sheetsOf([
        ...exams,
        ...parseDatesheet(
          page(
            [['A', 'Lab', '1 Dec 2026', '10:00']],
            ['Course Code', 'Course Name', 'Date', 'Time'],
          ),
          'practical',
        ),
      ]),
    ).toEqual(['MST-1', 'MST-2', 'Practical']);
  });
});
