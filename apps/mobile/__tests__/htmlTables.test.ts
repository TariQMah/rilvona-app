import {
  extractLinks,
  extractTables,
  formEncode,
  hiddenFields,
  resolveUrl,
  textOf,
} from '../src/cuims/htmlTables';

describe('cuims html helpers', () => {
  it('extracts innermost tables and skips layout tables', () => {
    const html = `
      <table id="layout"><tr><td>
        <table><caption>Attendance</caption>
          <tr><th>Subject</th><th>Delivered</th><th>Attended</th></tr>
          <tr><td>Algorithms &amp; DS</td><td>40</td><td> 36 </td></tr>
          <tr><td>OS<br>Lab</td><td>20</td><td>18</td></tr>
        </table>
      </td></tr></table>`;
    const tables = extractTables(html);
    expect(tables).toHaveLength(1);
    expect(tables[0]).toEqual({
      caption: 'Attendance',
      headers: ['Subject', 'Delivered', 'Attended'],
      rows: [
        ['Algorithms & DS', '40', '36'],
        ['OS Lab', '20', '18'],
      ],
    });
  });

  it('extracts links and ignores javascript/anchor links', () => {
    const links = extractLinks(
      `<a href="/Attendance.aspx?x=1&amp;y=2"><i></i> My Attendance </a><a href="#">no</a><a href="javascript:__doPostBack('a','')">pb</a>`,
    );
    expect(links).toEqual([
      { href: '/Attendance.aspx?x=1&y=2', text: 'My Attendance' },
    ]);
  });

  it('reads hidden fields and form-encodes values', () => {
    const fields = hiddenFields(
      `<input type="hidden" name="__VIEWSTATE" id="v" value="a+b/c=" /><input type="text" name="t" value="x"><input name="hfdata" type="hidden" id="hfdata" />`,
    );
    expect(fields).toEqual({ __VIEWSTATE: 'a+b/c=', hfdata: '' });
    expect(formEncode({ 'a b': 'c&d', e: '+/=' })).toBe(
      'a%20b=c%26d&e=%2B%2F%3D',
    );
  });

  it('resolves relative URLs', () => {
    const base = 'https://students.cuchd.in/uims/Home.aspx?x=1';
    expect(resolveUrl('/a.aspx', base)).toBe(
      'https://students.cuchd.in/a.aspx',
    );
    expect(resolveUrl('Att.aspx?z=1', base)).toBe(
      'https://students.cuchd.in/uims/Att.aspx?z=1',
    );
    expect(resolveUrl('../Att.aspx', base)).toBe(
      'https://students.cuchd.in/Att.aspx',
    );
    expect(resolveUrl('https://lms.cuchd.in/x', base)).toBe(
      'https://lms.cuchd.in/x',
    );
    expect(resolveUrl('data:image/png;base64,/9j/AAAA', base)).toBe(
      'data:image/png;base64,/9j/AAAA',
    );
    expect(resolveUrl('Att.aspx', 'https://students.cuchd.in/')).toBe(
      'https://students.cuchd.in/Att.aspx',
    );
  });

  it('collapses text', () => {
    expect(textOf('<b>A</b>&nbsp;&#38;  <i>B</i>')).toBe('A & B');
  });
});

import { describePage } from '../src/cuims/htmlTables';

describe('describePage', () => {
  it('describes controls and endpoints without copying values', () => {
    const html = `<title>Attendance</title><h3>Course Wise</h3>
      <form action="./Page.aspx?x=1"><input name="txtSecret" type="text" value="SECRET123">
      <select name="ddlSession"><option>2026 Odd</option><option>2025 Even</option></select>
      <input type="submit" name="btnShow" value="Show"><input type="hidden" name="__VIEWSTATE" value="zzz"></form>
      <script>$.ajax({ url: "GetData.ashx", type: "POST" }); __doPostBack('btnShow','');</script>`;
    const info = describePage(html);
    expect(info.title).toBe('Attendance');
    expect(info.controls).toContain('input:submit:btnShow');
    expect(info.controls.join(' ')).toContain('2026 Odd');
    expect(JSON.stringify(info)).not.toContain('SECRET123');
    expect(info.endpoints).toContain('GetData.ashx');
    expect(info.postbacks).toContain('btnShow()');
  });
});

describe('sanitizeTables', () => {
  const { sanitizeTables } = require('../src/cuims/htmlTables');

  it('keeps only safe fields of a profile table and drops private ones', () => {
    const [clean] = sanitizeTables([
      {
        headers: ['Account No.', '123', ''],
        rows: [
          ['UID', 'X1'],
          ['Status', 'Active'],
          ['Student Name', 'A B'],
          ['Father Name', 'P Q'],
          ['Mobile No.', '9999999999'],
          ['DOB', '1 Jan 2000'],
          ['Program Name', 'MCA'],
          ['OverAll Attendance', '85.4'],
        ],
      },
    ]);
    const flat = JSON.stringify(clean);
    expect(clean.headers).toEqual(['Field', 'Value']);
    expect(flat).toContain('OverAll Attendance');
    expect(flat).not.toMatch(/Father|Mobile|DOB|Account|9999999999|123/);
  });

  it('drops leave history and keeps ordinary tables', () => {
    const subjects = {
      headers: ['Subject', 'Attended', 'Delivered'],
      rows: [['A', '1', '2']],
    };
    const leave = {
      headers: ['From Date', 'To Date', 'Remarks'],
      rows: [['1', '2', 'x']],
    };
    expect(sanitizeTables([subjects, leave])).toEqual([subjects]);
  });
});
