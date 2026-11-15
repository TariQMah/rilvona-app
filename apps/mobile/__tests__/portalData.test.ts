import {
  attendanceTableFromReport,
  extractReportParams,
  isPortalErrorPage,
  isSignedInDashboard,
  marksTableFromHtml,
  slotTimeLabel,
  timetableTableFromHtml,
  unwrapPageMethod,
} from '../src/cuims/portalData';

describe('attendance', () => {
  it('finds the report and session ids in the page script', () => {
    const html = `<script>function x(){ getReport('abc123XYZ=', 1); } var s = CurrentSession(4021);</script>`;
    expect(extractReportParams(html)).toEqual({
      reportId: 'abc123XYZ=',
      sessionId: '4021',
    });
    expect(extractReportParams('<html></html>')).toBeNull();
  });

  it('unwraps the double-encoded page method response', () => {
    const body = JSON.stringify({ d: JSON.stringify([{ Title: 'A' }]) });
    expect(unwrapPageMethod(body)).toEqual([{ Title: 'A' }]);
    expect(unwrapPageMethod('nope')).toBeNull();
  });

  it('builds a table from eligibility counts and reports field names only', () => {
    const { table, keys } = attendanceTableFromReport([
      {
        Title: 'Operating Systems',
        Total_Attd: '30',
        Total_Delv: '34',
        EligibilityAttended: '31',
        EligibilityDelivered: '34',
        DutyLeave_N_P: '1',
        DutyLeave_Others: '0',
        EncryptCode: 'zz',
      },
      { Title: 'Missing counts' },
    ]);
    expect(table?.rows).toEqual([['Operating Systems', '', '31', '34', '1']]);
    expect(keys).toContain('EncryptCode');
  });

  it('returns no table when field names are unknown', () => {
    expect(attendanceTableFromReport([{ foo: 1 }]).table).toBeNull();
  });
});

describe('timetable', () => {
  it('normalises time labels', () => {
    expect(slotTimeLabel('09:40 - 10:20 AM')).toBe('09:40 - 10:20');
    expect(slotTimeLabel('1:00 - 1:40 PM')).toBe('13:00 - 13:40');
    expect(slotTimeLabel('11:30 - 12:10 PM')).toBe('11:30 - 12:10');
    expect(slotTimeLabel('nothing')).toBeNull();
  });

  it('flattens the weekly grid using the course-code table', () => {
    const html = `
      <table id="ContentPlaceHolder1_gvMyTimeTable">
        <tr><th scope="col">Time</th><th scope="col">Monday</th><th scope="col">Tuesday</th></tr>
        <tr><td>09:40 - 10:20 AM</td><td>CSB-421:L :: GP-All: By Steve Samson(E11030) at 1-3-C</td><td></td></tr>
        <tr><td>1:00 - 1:40 PM</td><td></td><td>CSR-410:P :: GP-C: By Jane Roe(E2) at 1-2-C</td></tr>
      </table>
      <table id="ContentPlaceHolder1_gvMyTimeTableDetails">
        <tr><th>Course Code</th><th>Course Name</th></tr>
        <tr><td>CSB-421</td><td>Computer Networks</td></tr>
        <tr><td>CSR-410</td><td>Networks Lab</td></tr>
      </table>`;
    expect(timetableTableFromHtml(html)?.rows).toEqual([
      [
        'Monday',
        '09:40 - 10:20',
        'Computer Networks',
        'CSB-421',
        '1-3-C',
        'Steve Samson',
        'Lecture',
      ],
      [
        'Tuesday',
        '13:00 - 13:40',
        'Networks Lab',
        'CSR-410',
        '1-2-C',
        'Jane Roe',
        'Practical',
      ],
    ]);
  });

  it('strips stray brackets around a room', () => {
    const html = `<table><tr><th>T</th><th>Monday</th><th>Tuesday</th></tr>
      <tr><td>09:40 - 10:20 AM</td><td>CS-1:L :: GP-A: By Jo Doe(E1) at (E9422)</td><td></td></tr></table>
      <table><tr><th>Code</th><th>Name</th></tr><tr><td>CS-1</td><td>Course</td></tr></table>`;
    expect(timetableTableFromHtml(html)?.rows[0]?.[4]).toBe('E9422');
  });

  it('returns null when there is no grid', () => {
    expect(timetableTableFromHtml('<p>nothing</p>')).toBeNull();
  });
});

describe('marks and errors', () => {
  it('reads the accordion', () => {
    const html = `<div id="accordion"><h3>Data Structures</h3><div><table><tbody>
      <tr><td>MST1</td><td>20</td><td>17</td></tr><tr><td>Quiz</td><td>10</td><td>NA</td></tr></tbody></table></div></div>`;
    expect(marksTableFromHtml(html)?.rows).toEqual([
      ['Data Structures', 'MST1', '20', '17'],
      ['Data Structures', 'Quiz', '10', 'NA'],
    ]);
    expect(marksTableFromHtml('<p/>')).toBeNull();
  });

  it('detects the portal error page', () => {
    expect(isPortalErrorPage('<h1>Whoops, Something broke!</h1>')).toBe(true);
    expect(isPortalErrorPage('', 'https://students.cuchd.in/error.html')).toBe(
      true,
    );
    expect(
      isPortalErrorPage('<p>ok</p>', 'https://students.cuchd.in/x.aspx'),
    ).toBe(false);
  });
});

describe('attendance log', () => {
  const {
    parseAttDate,
    statusFromCode,
    attendanceLogFromReport,
    attendanceCourseRefs,
  } = require('../src/cuims/portalData');

  it('reads the date formats the portal might use, day-first', () => {
    expect(parseAttDate('05/09/2026')).toBe('2026-09-05');
    expect(parseAttDate('5-Sep-2026')).toBe('2026-09-05');
    expect(parseAttDate('Sep 5, 2026')).toBe('2026-09-05');
    expect(parseAttDate('2026-09-05T00:00:00')).toBe('2026-09-05');
    expect(parseAttDate('31/02/2026')).toBeNull();
    expect(parseAttDate('soon')).toBeNull();
  });

  it('maps status codes', () => {
    expect(statusFromCode('P')).toBe('PRESENT');
    expect(statusFromCode('a')).toBe('ABSENT');
    expect(statusFromCode('DL')).toBe('DUTY_LEAVE');
    expect(statusFromCode('X')).toBe('OTHER');
  });

  it('builds log entries and counts unreadable ones without leaking values', () => {
    const course = { title: 'OS', encryptCode: 'e' };
    const out = attendanceLogFromReport(
      [
        {
          AttDate: '05/09/2026',
          Timing: '09:40 - 10:20 AM',
          AttendanceCode: 'P',
        },
        { AttDate: 'someday 12', AttendanceCode: 'A' },
      ],
      course,
    );
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0]).toMatchObject({
      date: '2026-09-05',
      status: 'PRESENT',
      title: 'OS',
    });
    expect(out.dropped).toBe(1);
    expect(out.badShape).toBe('aaaaaaa 99');
  });

  it('lists subject refs that have a history token', () => {
    expect(
      attendanceCourseRefs([
        { Title: 'OS', Code: 'C1', EncryptCode: 'tok' },
        { Title: 'No token' },
      ]),
    ).toEqual([{ title: 'OS', code: 'C1', encryptCode: 'tok' }]);
  });
});

describe('saved session check', () => {
  const dashboard =
    '<form><input type="hidden" value="4242" name="ctl00$hfdfdfds_sid" id="hfdfdfds_sid" /></form>';
  it('accepts the signed-in dashboard', () => {
    expect(
      isSignedInDashboard(
        dashboard,
        'https://students.cuchd.in/StudentHome.aspx',
      ),
    ).toBe(true);
  });
  it('rejects the login form, an error page and anything else', () => {
    expect(
      isSignedInDashboard('<input name="txtLoginPassword" />' + dashboard),
    ).toBe(false);
    expect(isSignedInDashboard('<input name="txtUserId" />')).toBe(false);
    expect(
      isSignedInDashboard(dashboard, 'https://students.cuchd.in/error.html'),
    ).toBe(false);
    expect(isSignedInDashboard('Whoops, Something broke' + dashboard)).toBe(
      false,
    );
    expect(isSignedInDashboard('<html>hello</html>')).toBe(false);
  });
});
