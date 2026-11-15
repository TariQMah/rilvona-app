import {
  announcementHtml,
  announcementsFromHtml,
  mentorSectionFromDashboard,
  hiddenValueById,
  htmlToLines,
  identityFromDashboard,
  mentorFromHtml,
  mentorHtml,
  messagesHtml,
  noticesFromHtml,
  normalizeImageDataUri,
} from '../profileData';
import {
  unwrapPageMethod,
  describeFailure,
  fullReportBody,
  fullReportTypes,
  selectedSessionValue,
  studentIdFromReport,
} from '../portalData';

describe('full report request (mirrors the portal script)', () => {
  const html = `
    <select id="ContentPlaceHolder1_ddlSession" name="ctl00$ddlSession"><option value="26271" selected="selected">CurrentSession (26271)</option><option value="25261">Old</option></select>
    <select id="drpfilter"><option value="DS">Date Wise</option><option value="TD" selected>Till Date(All days)</option></select>`;

  it('uses "0" for empty dates and keeps every field the script sends', () => {
    expect(JSON.parse(fullReportBody('ENC', 'REPORT', '26271', 'TD'))).toEqual({
      course: 'ENC',
      UID: 'REPORT',
      fromDate: '0',
      toDate: '0',
      type: 'TD',
      Session: '26271',
    });
  });

  it('reads the till-date filter value and the selected session from the page', () => {
    expect(fullReportTypes(html)[0]).toBe('TD');
    expect(fullReportTypes('<p>nothing</p>')).toContain('All');
    expect(selectedSessionValue(html)).toBe('26271');
  });

  it('explains a failed call without echoing values', () => {
    expect(
      describeFailure(
        500,
        JSON.stringify({
          Message: 'Invalid JSON primitive: x.',
          StackTrace: null,
        }),
      ),
    ).toBe('status 500: Invalid JSON primitive: x.');
    expect(
      describeFailure(404, '<html><body>Not here</body></html>'),
    ).toContain('status 404');
  });

  it('finds the numeric student id in the summary report', () => {
    expect(studentIdFromReport([{ Title: 'x' }, { StudentId: 123456 }])).toBe(
      '123456',
    );
    expect(studentIdFromReport([{ StudentId: 'abc' }])).toBeUndefined();
  });
});

describe('mentor card', () => {
  it('reads labelled fields from table rows', () => {
    const html = JSON.stringify(
      '<table><tr><td>Mentor Name</td><td>Dr. Jane Roe</td></tr><tr><td>Designation</td><td>Assistant Professor</td></tr><tr><td>Mobile</td><td>+91 98765 43210</td></tr><tr><td>Email</td><td>jane.roe@cumail.in</td></tr></table>',
    );
    const mentor = mentorFromHtml(mentorHtml(html));
    expect(mentor).toMatchObject({
      name: 'Dr. Jane Roe',
      designation: 'Assistant Professor',
      phone: '+919876543210',
      email: 'jane.roe@cumail.in',
    });
  });

  it('reads "Label: value" lines and keeps the lines as a fallback', () => {
    const mentor = mentorFromHtml(
      '<div>Mentor Details</div><div>Name : John Doe</div><div>Department: CSE</div>',
    );
    expect(mentor?.name).toBe('John Doe');
    expect(mentor?.department).toBe('CSE');
    expect(mentor?.lines.length).toBeGreaterThan(0);
  });

  it('returns null when the portal has nothing to show', () => {
    expect(mentorFromHtml('Nothing Found.')).toBeNull();
  });
});

describe('notices', () => {
  const wrap = (html: string) => JSON.stringify({ d: html });

  it('turns list items into notices with an ISO date', () => {
    const html =
      '<div id="div_Announcements"><ul><li><b>Mid semester exam schedule</b><br/>Published on 12 Oct 2026 for all sections</li><li>Fee reminder</li></ul></div>';
    const notices = noticesFromHtml(html, 'ANNOUNCEMENT');
    expect(notices).toHaveLength(2);
    expect(notices[0]).toMatchObject({
      kind: 'ANNOUNCEMENT',
      title: 'Mid semester exam schedule',
      date: '2026-10-12',
    });
  });

  it('splits the announcements and messages envelopes', () => {
    expect(
      announcementHtml(
        wrap(
          'x--IsNewAnnouncement--1--IsNewAnnouncement--<html><div id="div_Announcements"><li>Hello there</li></div></html>',
        ),
      ),
    ).toContain('Hello there');
    expect(announcementHtml(wrap('0'))).toBeNull();
    expect(
      messagesHtml(
        wrap(
          '1----StudentMyMessages----<div class="divStudentMyMessages"><li>Meet your mentor</li></div>----StudentMyMessages----0',
        ),
      ),
    ).toContain('Meet your mentor');
    expect(messagesHtml(wrap('0'))).toBeNull();
  });

  it('ignores placeholders and duplicates', () => {
    expect(
      noticesFromHtml(
        '<ul><li>Loading...</li><li>View All</li><li>Same thing</li><li>same thing</li></ul>',
        'MESSAGE',
      ),
    ).toHaveLength(1);
  });
});

describe('dashboard helpers', () => {
  it('reads a hidden field by id regardless of attribute order', () => {
    expect(
      hiddenValueById(
        '<input type="hidden" value="4242" name="ctl00$hfdfdfds_sid" id="hfdfdfds_sid" />',
        'hfdfdfds_sid',
      ),
    ).toBe('4242');
  });

  it('finds the header name and photo address', () => {
    const html =
      '<div class="user-n-mob"><span>PRIYA SHARMA</span><small>23BCS10452</small></div><img src="assets/img/logo.png"/><img id="imgProfile" src="frmPhoto.aspx?x=1"/>';
    expect(identityFromDashboard(html)).toEqual({
      name: 'PRIYA SHARMA',
      photoSrc: 'frmPhoto.aspx?x=1',
      photoCandidates: ['frmPhoto.aspx?x=1'],
    });
  });

  it('joins table cells with a separator', () => {
    expect(htmlToLines('<tr><td>A</td><td>B</td></tr><p>C</p>')).toEqual([
      'A | B',
      'C',
    ]);
  });
});

describe('real portal shapes', () => {
  it('reads the per-subject report, whose "d" is an object holding a JSON string', () => {
    const rows = [{ AttDate: '12/10/2026', AttendanceCode: 'P' }];
    expect(
      unwrapPageMethod(JSON.stringify({ d: { Result: JSON.stringify(rows) } })),
    ).toEqual(rows);
    expect(
      unwrapPageMethod(JSON.stringify({ d: { Result: 'No Data Found' } })),
    ).toEqual([]);
    expect(
      unwrapPageMethod(JSON.stringify({ d: JSON.stringify(rows) })),
    ).toEqual(rows);
  });

  it('keeps one announcement together instead of splitting its rules into notices', () => {
    const html =
      '<div id="div_Announcements"><div>12 Oct 2026</div><div>17:41:24</div><ul><li>Open to all students.</li><li>Performance time is 3 to 4 Minutes</li></ul><div>13 Oct 2026</div><div>09:00:00</div><p>Library closed on Friday</p></div>';
    const items = announcementsFromHtml(html);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      date: '2026-10-12',
      title: 'Open to all students.',
      body: 'Performance time is 3 to 4 Minutes',
    });
    expect(items[1]).toMatchObject({
      date: '2026-10-13',
      title: 'Library closed on Friday',
    });
  });

  it('drops label-only message sections and shortens long message titles', () => {
    const html =
      '<ul><li>1. Pending Documents: The status of Pending documents is as given below, you are required to submit the same in Block-A1<br/>Document Remarks: (Marksheets pending)</li><li>Leave Message</li><li>Other Message</li></ul>';
    const notices = noticesFromHtml(html, 'MESSAGE');
    expect(notices).toHaveLength(1);
    expect(notices[0]?.title).toBe('Pending Documents');
    expect(notices[0]?.body).toContain('required to submit');
    expect(notices[0]?.body).toContain('Marksheets pending');
  });

  it('ignores the mentor API template values', () => {
    expect(
      mentorFromHtml(mentorHtml(JSON.stringify(['value1', 'value2']))),
    ).toBeNull();
    expect(mentorFromHtml('value1\nvalue2')).toBeNull();
  });

  it('finds a Mentor Details block rendered in the dashboard page', () => {
    const page =
      '<div><h4>Mentor Details</h4><table><tr><td>Name</td><td>Dr. A B</td></tr><tr><td>Mobile</td><td>9876543210</td></tr></table></div><h4>Other</h4>';
    const section = mentorSectionFromDashboard(page);
    expect(mentorFromHtml(section ?? '')).toMatchObject({
      name: 'Dr. A B',
      phone: '9876543210',
    });
    expect(
      mentorSectionFromDashboard(
        '<h4>Mentor Details</h4><div id="divStudentMentorDetails"></div>',
      ),
    ).toBeNull();
  });
});

describe('inline photo', () => {
  it('names the real image type, whatever the portal calls it', () => {
    expect(
      normalizeImageDataUri('data:image/png;base64,/9j/4AAQSkZJRg=='),
    ).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect(normalizeImageDataUri('data:image/jpeg;base64,iVBORw0KGgo=')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
  });
  it('rejects anything that is not a base64 image', () => {
    expect(normalizeImageDataUri('data:text/html;base64,PGh0bWw+')).toBeNull();
    expect(normalizeImageDataUri('data:image/png;base64,AAAA')).toBeNull();
    expect(normalizeImageDataUri('https://students.cuchd.in/a.png')).toBeNull();
  });

  it('reads the mentor box the portal renders into the dashboard', () => {
    const page =
      '<div class="portlet"><div class="portlet-title"><div class="portlet-caption"><i class="fa fa-user" aria-hidden="true"></i>Mentor Details</h9> </div></div>' +
      '<div id="ContentPlaceHolder9_divStudentMentorDetails" class="portlet-body"> <ul style="padding-left: 99px;"> ' +
      '<li><b>Mentor Name:</b> Jane Roe (E12345)</li> <li><b>Email Id:</b> jane.roe@cumail.in</li> <li><b>Mobile No:</b> 98765 43210</li> </ul> </div></div><div>Other</div>';
    const mentor = mentorFromHtml(mentorSectionFromDashboard(page) ?? '');
    expect(mentor).toMatchObject({
      name: 'Jane Roe',
      email: 'jane.roe@cumail.in',
      phone: '9876543210',
    });
  });

  it('finds a heading that has an icon before its text', () => {
    const page =
      '<h9><i class="fa fa-user"></i>Mentor Details</h9><ul><li><b>Mentor Name:</b> Dr. A B</li></ul><h4>Other</h4>';
    expect(mentorFromHtml(mentorSectionFromDashboard(page) ?? '')?.name).toBe(
      'Dr. A B',
    );
  });

  it('skips an empty mentor box', () => {
    expect(
      mentorSectionFromDashboard(
        '<div id="ContentPlaceHolder9_divStudentMentorDetails"> </div>',
      ),
    ).toBeNull();
  });
});
