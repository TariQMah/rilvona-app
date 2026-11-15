import CookieManager from '@react-native-cookies/cookies';
import { errorMessage } from '../lib/errors';
import { campusBase, getCampus, isUniversityHost } from './campus';
import {
  extractLinks,
  extractTables,
  sanitizeTables,
  formEncode,
  hiddenFields,
  decodeEntities,
  resolveUrl,
  textOf,
  describePage,
  type PageStructure,
  type RawTable,
} from './htmlTables';
import {
  attendanceCourseRefs,
  attendanceLogFromReport,
  attendanceTableFromReport,
  describeFailure,
  extractReportParams,
  fullReportBody,
  fullReportTypes,
  isPortalErrorPage,
  isSignedInDashboard,
  marksTableFromHtml,
  selectedSessionValue,
  semesterFromReport,
  studentIdFromReport,
  timetableTableFromHtml,
  unwrapPageMethod,
  type LogEntry,
} from './portalData';
import { datesheetPathFromMenu, htmlFromPageMethod } from './datesheetData';
import {
  announcementHtml,
  hiddenValueById,
  identityFromDashboard,
  mentorFromHtml,
  mentorHtml,
  messagesHtml,
  noticesFromHtml,
  normalizeImageDataUri,
  announcementsFromHtml,
  mentorSectionFromDashboard,
  type Mentor,
  type Notice,
} from './profileData';

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

export class CuimsError extends Error {}

type Page = { url: string; status: number; html: string };
export type PortalPage = Page;

export type LoginChallenge = {
  uid: string;
  actionUrl: string;
  pageUrl: string;
  hidden: Record<string, string>;
  captchaDataUri: string;
};

export type DiscoveryReport = {
  pages: {
    path: string;
    from?: string;
    status?: number;
    tables: { headers: string[]; rows: number }[];
    structure?: PageStructure;
  }[];
  menu: { text: string; path: string }[];
  /** Plain-language diagnostics: counts and field names only, never values. */
  notes: string[];
};

const isCuHost = isUniversityHost;
const pathOf = (url: string) =>
  url.replace(/^https?:\/\/[^/]+/i, '').split('?')[0] ?? '';

async function request(
  url: string,
  init: {
    method?: 'GET' | 'POST';
    body?: string;
    referer?: string;
    json?: boolean;
  } = {},
): Promise<Page> {
  if (!isCuHost(url))
    throw new CuimsError('Refusing to contact a non-CU address');
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };
  if (init.json) {
    headers.Accept = 'application/json, text/javascript, */*; q=0.01';
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  if (init.body !== undefined)
    headers['Content-Type'] = init.json
      ? 'application/json; charset=utf-8'
      : 'application/x-www-form-urlencoded';
  if (init.referer) headers.Referer = init.referer;
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? 'GET',
      headers,
      body: init.body,
    });
  } catch {
    throw new CuimsError(
      'Could not reach Chandigarh University. Check your internet connection.',
    );
  }
  const html = await response.text();
  return { url: response.url || url, status: response.status, html };
}

/** Pulls a human-readable message out of the portal's error markup or alert scripts. */
export function pageMessage(html: string): string | null {
  const alertMatch = /(?:alert|swal)\(\s*["']([^"']{3,200})["']/i.exec(html);
  if (alertMatch?.[1]) return decodeEntities(alertMatch[1]);
  const spans = html.matchAll(
    /<span[^>]*id="[^"]*(?:lbl|Error|Msg|Message)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
  );
  for (const span of spans) {
    const text = textOf(span[1] ?? '');
    if (text.length >= 3) return text;
  }
  return null;
}

async function fetchCaptcha(
  imageUrl: string,
  referer: string,
): Promise<string> {
  if (!isCuHost(imageUrl)) throw new CuimsError('Unexpected captcha address');
  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': USER_AGENT, Referer: referer },
  });
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new CuimsError('Could not load the captcha image'));
    reader.readAsDataURL(blob);
  });
}

async function challengeFromPage(
  uid: string,
  page: Page,
): Promise<LoginChallenge | null> {
  if (!/name="txtLoginPassword"/i.test(page.html)) return null;
  const action = /<form[^>]*\saction="([^"]*)"/i.exec(page.html)?.[1];
  const captcha = /src="(GenerateCaptcha\.aspx[^"]*)"/i.exec(page.html)?.[1];
  if (!action || !captcha) return null;
  const actionUrl = resolveUrl(decodeEntities(action), page.url);
  const captchaDataUri = await fetchCaptcha(
    resolveUrl(decodeEntities(captcha), page.url),
    page.url,
  );
  return {
    uid,
    actionUrl,
    pageUrl: page.url,
    hidden: hiddenFields(page.html),
    captchaDataUri,
  };
}

/**
 * Reuse the portal session from the last login (its cookies live in the phone's cookie jar). Returns the dashboard
 * when the session is still alive, or null when it has expired and a fresh login with a captcha is needed.
 * One ordinary page request; nothing is submitted.
 */
export async function resumeSession(): Promise<Page | null> {
  try {
    const page = await request(`${campusBase()}StudentHome.aspx`, {
      referer: campusBase(),
    });
    return page.status === 200 && isSignedInDashboard(page.html, page.url)
      ? page
      : null;
  } catch {
    return null;
  }
}

export type PortalSessionState = 'alive' | 'expired' | 'unreachable';

/**
 * Asks the portal whether the saved session still works, telling a lapsed session (a fresh captcha login is needed)
 * apart from a portal or connection that cannot be reached right now (nothing to do, so no prompt). One ordinary
 * page request; nothing is submitted.
 */
export async function checkPortalSession(): Promise<PortalSessionState> {
  let page: Page;
  try {
    page = await request(`${campusBase()}StudentHome.aspx`, {
      referer: campusBase(),
    });
  } catch {
    return 'unreachable';
  }
  if (page.status >= 500 || page.status === 0) return 'unreachable';
  return page.status === 200 && isSignedInDashboard(page.html, page.url)
    ? 'alive'
    : 'expired';
}

/** Forget the portal session, e.g. when the account is unlinked. */
export async function clearPortalSession(): Promise<void> {
  await CookieManager.clearAll().catch(() => undefined);
}

/** Step 1: submit the UID on a clean session and load the captcha. */
export async function beginLogin(uid: string): Promise<LoginChallenge> {
  await CookieManager.clearAll();
  const landing = await request(campusBase());
  const step1 = await request(campusBase(), {
    method: 'POST',
    referer: campusBase(),
    body: formEncode({
      ...hiddenFields(landing.html),
      txtUserId: uid,
      btnNext: 'NEXT',
    }),
  });
  const challenge = await challengeFromPage(uid, step1);
  if (!challenge) {
    throw new CuimsError(
      pageMessage(step1.html) ??
        'CUIMS did not accept this UID. Check it and try again.',
    );
  }
  return challenge;
}

export type LoginResult =
  | { ok: true; page: Page }
  | { ok: false; message: string; challenge: LoginChallenge | null };

/** Step 2: submit password and captcha. A failed attempt returns a fresh captcha. */
export async function submitLogin(
  challenge: LoginChallenge,
  password: string,
  captcha: string,
): Promise<LoginResult> {
  const page = await request(challenge.actionUrl, {
    method: 'POST',
    referer: challenge.pageUrl,
    body: formEncode({
      ...challenge.hidden,
      txtLoginPassword: password,
      txtcaptcha: captcha.trim(),
      btnLogin: 'LOGIN',
    }),
  });
  const stillLogin = /name="txtLoginPassword"|name="txtUserId"/i.test(
    page.html,
  );
  if (!stillLogin) {
    // Write the session cookies to disk so the next refresh can reuse them.
    void Promise.resolve(CookieManager.flush()).catch(() => undefined);
    return { ok: true, page };
  }
  const message =
    pageMessage(page.html) ??
    'Login failed. Check your password and the captcha.';
  const next =
    (await challengeFromPage(challenge.uid, page)) ??
    (await beginLogin(challenge.uid).catch(() => null));
  return { ok: false, message, challenge: next };
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const ATTENDANCE_PAGE = 'frmStudentCourseWiseAttendanceSummary.aspx';
// The attendance page only opens with this `type` parameter; without it the portal answers with its error page.
const ATTENDANCE_TYPE = '?type=etgkYfqBdH1fSfc255iYGw==';
const TIMETABLE_PAGE = 'frmMyTimeTable.aspx';
const MARKS_PAGE = 'frmStudentMarksView.aspx';
const TIMETABLE_LOAD_TARGET =
  'ctl00$ContentPlaceHolder1$ReportViewer1$ctl09$Reserved_AsyncLoadTarget';

/**
 * After login, read attendance, timetable and marks the same way the portal's own pages do (the attendance table
 * is filled from a JSON call, the timetable from a report viewer, marks from an accordion), and convert each into
 * a small table the server understands. One request per step, a pause between steps, no retries; if the portal
 * answers with its error page the run stops. Diagnostics hold counts and field names only, never values.
 */
export async function collectPortalTables(start: Page): Promise<{
  tables: RawTable[];
  report: DiscoveryReport;
  attendanceLog: LogEntry[];
  profile: PortalProfile;
}> {
  const tables: RawTable[] = [];
  const attendanceLog: LogEntry[] = [];
  let studentId: string | undefined;
  let section: string | undefined;
  let group: string | undefined;
  let semester: number | undefined;
  const report: DiscoveryReport = { pages: [], menu: [], notes: [] };
  const origin =
    /^https:\/\/[^/]+/i.exec(start.url)?.[0] ?? campusBase().replace(/\/$/, '');

  const record = (
    page: Page,
    found: RawTable[],
    from?: string,
    withStructure = false,
  ) => {
    report.pages.push({
      path: pathOf(page.url),
      from,
      status: page.status,
      tables: found.map(t => ({
        headers: t.headers.slice(0, 10),
        rows: t.rows.length,
      })),
      structure: withStructure ? describePage(page.html) : undefined,
    });
  };

  report.menu = extractLinks(start.html)
    .slice(0, 80)
    .map(l => ({ text: l.text, path: pathOf(resolveUrl(l.href, start.url)) }));
  record(start, sanitizeTables(extractTables(start.html)), undefined, true);

  let stopped = false;
  const open = async (path: string, label: string): Promise<Page | null> => {
    if (stopped) return null;
    await sleep(1500);
    const page = await request(`${origin}/${path}`, { referer: start.url });
    record(page, [], pathOf(`${origin}/${path}`), true);
    if (isPortalErrorPage(page.html, page.url)) {
      report.notes.push(
        `${label}: the portal answered with its error page, so the run stopped here`,
      );
      stopped = true;
      return null;
    }
    return page;
  };

  try {
    // Attendance
    const attendancePage = await open(
      `${ATTENDANCE_PAGE}${ATTENDANCE_TYPE}`,
      'Attendance',
    );
    if (attendancePage) {
      const params = extractReportParams(attendancePage.html);
      if (!params) {
        report.notes.push(
          'Attendance: the page did not contain the report ids it normally has',
        );
      } else {
        await sleep(800);
        const response = await request(
          `${origin}/${ATTENDANCE_PAGE}/GetReport`,
          {
            method: 'POST',
            json: true,
            referer: attendancePage.url,
            body: JSON.stringify({
              UID: params.reportId,
              Session: params.sessionId,
            }),
          },
        );
        const items = unwrapPageMethod(response.html);
        if (!items) {
          report.notes.push(
            `Attendance: the report call returned status ${response.status} and no rows`,
          );
        } else {
          const { table, keys } = attendanceTableFromReport(items);
          report.notes.push(
            `Attendance: ${items.length} subject row(s); fields: ${
              keys.join(', ') || 'none'
            }`,
          );
          if (table) {
            tables.push(table);
            report.pages.push({
              path: `/${ATTENDANCE_PAGE}/GetReport`,
              status: response.status,
              tables: [{ headers: table.headers, rows: table.rows.length }],
            });
          }

          studentId = studentIdFromReport(items);
          semester = semesterFromReport(items);
          report.notes.push(
            `Semester: ${
              semester ? 'read from the report' : 'not in the report'
            }`,
          );

          // Lecture-by-lecture history, one small call per subject, like opening each subject in the portal.
          // The page's own script sends "0" for an empty date range and the value of its filter drop-down as `type`.
          let failed = 0;
          let dropped = 0;
          let badShape: string | undefined;
          let firstFailure: string | undefined;
          const codes = new Set<string>();
          const refs = attendanceCourseRefs(items).slice(0, 15);
          const session =
            selectedSessionValue(attendancePage.html) ?? params.sessionId;
          const types = fullReportTypes(attendancePage.html);
          let typeIndex = 0;
          for (const [position, ref] of refs.entries()) {
            await sleep(700);
            let entries: unknown[] | null = null;
            // Until one request shape works, try the candidate `type` values on the first subject only.
            const attempts = position === 0 ? types.length : 1;
            for (
              let attempt = 0;
              attempt < attempts && !entries;
              attempt += 1
            ) {
              const index = position === 0 ? attempt : typeIndex;
              const full = await request(
                `${origin}/${ATTENDANCE_PAGE}/GetFullReport`,
                {
                  method: 'POST',
                  json: true,
                  referer: attendancePage.url,
                  body: fullReportBody(
                    ref.encryptCode,
                    params.reportId,
                    session,
                    types[index] ?? 'All',
                  ),
                },
              );
              entries = unwrapPageMethod(full.html);
              if (entries) typeIndex = index;
              else firstFailure ??= describeFailure(full.status, full.html);
              if (!entries && attempt + 1 < attempts) await sleep(500);
            }
            if (!entries) {
              failed += 1;
              continue;
            }
            const parsed = attendanceLogFromReport(entries, ref);
            attendanceLog.push(...parsed.entries);
            dropped += parsed.dropped;
            badShape ??= parsed.badShape;
            section ??= parsed.section;
            group ??= parsed.group;
            parsed.codes.forEach(c => codes.add(c));
          }
          if (refs.length > 0) {
            report.notes.push(
              `Attendance history: ${attendanceLog.length} lecture(s) from ${
                refs.length - failed
              }/${refs.length} subject(s); status codes: ${
                Array.from(codes).join(', ') || 'none'
              }` +
                (dropped > 0
                  ? `; ${dropped} entr${
                      dropped === 1 ? 'y' : 'ies'
                    } with an unreadable date (shape ${badShape ?? '?'})`
                  : '') +
                (firstFailure
                  ? `; first failure: ${firstFailure}; type options tried: ${types.join(
                      '/',
                    )}`
                  : ''),
            );
          }
        }
      }
    }

    // Timetable
    const timetablePage = await open(TIMETABLE_PAGE, 'Timetable');
    if (timetablePage) {
      const hidden = hiddenFields(timetablePage.html);
      delete hidden.__EVENTVALIDATION;
      await sleep(800);
      const loaded = await request(`${origin}/${TIMETABLE_PAGE}`, {
        method: 'POST',
        referer: timetablePage.url,
        body: formEncode({ ...hidden, __EVENTTARGET: TIMETABLE_LOAD_TARGET }),
      });
      const table =
        timetableTableFromHtml(loaded.html) ??
        timetableTableFromHtml(timetablePage.html);
      if (table) {
        tables.push(table);
        report.notes.push(`Timetable: ${table.rows.length} class slot(s)`);
        report.pages.push({
          path: `/${TIMETABLE_PAGE}`,
          status: loaded.status,
          tables: [{ headers: table.headers, rows: table.rows.length }],
        });
      } else {
        report.notes.push('Timetable: no weekly grid found in the page');
      }
    }

    // Marks
    const marksPage = await open(MARKS_PAGE, 'Marks');
    if (marksPage) {
      const table = marksTableFromHtml(marksPage.html);
      if (table) {
        tables.push(table);
        report.notes.push(`Marks: ${table.rows.length} assessment row(s)`);
        report.pages.push({
          path: `/${MARKS_PAGE}`,
          status: marksPage.status,
          tables: [{ headers: table.headers, rows: table.rows.length }],
        });
      } else {
        report.notes.push('Marks: no marks accordion found in the page');
      }
    }
  } catch (error) {
    report.notes.push(
      error instanceof CuimsError
        ? error.message
        : 'A request failed before everything could be read',
    );
  }

  const profile: PortalProfile = { section, group, semester, notices: [] };
  if (!stopped) {
    try {
      await collectProfile(start, origin, studentId, profile, report.notes);
    } catch (error) {
      report.notes.push(
        error instanceof CuimsError
          ? `Profile: ${error.message}`
          : 'Profile: a request failed',
      );
    }
  }
  return {
    tables: tables.slice(0, 25),
    report,
    attendanceLog: attendanceLog.slice(0, 4000),
    profile,
  };
}

export type PortalProfile = {
  name?: string;
  semester?: number;
  section?: string;
  group?: string;
  /** `data:image/...;base64,...` of the student's own portal photo. */
  photo?: string;
  mentor?: Mentor;
  notices: Notice[];
};

const MAX_PHOTO_BYTES = 350_000;

async function fetchPhoto(
  url: string,
  referer: string,
): Promise<{ dataUri?: string; reason?: string }> {
  if (url.startsWith('data:image/')) {
    const dataUri = normalizeImageDataUri(url);
    if (!dataUri) return { reason: 'not a recognised image' };
    return dataUri.length <= MAX_PHOTO_BYTES * 1.4
      ? { dataUri }
      : { reason: `too large (${Math.round(dataUri.length / 1000)} KB)` };
  }
  if (!isCuHost(url)) return { reason: 'not on a CU address' };
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Referer: referer },
  });
  if (!response.ok) return { reason: `status ${response.status}` };
  const blob = await response.blob();
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(blob.type))
    return { reason: `type ${blob.type || 'unknown'}` };
  if (blob.size > MAX_PHOTO_BYTES) return { reason: 'too large' };
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new CuimsError('Could not read the profile photo'));
    reader.readAsDataURL(blob);
  });
  return { dataUri };
}

/** What a response body looks like, without its content: its length and the first characters as a pattern. */
function bodyShape(body: string): string {
  const head = body.trim().slice(0, 40);
  const template = /^[\s[\]",]*(?:value\d*[\s",\]]*)+$/i.test(head);
  return `${body.length} chars: ${
    template ? head : head.replace(/[A-Za-z]/g, 'a').replace(/\d/g, '9')
  }`;
}

/**
 * The student's own dashboard extras, loaded the way the dashboard script loads them: header name and photo,
 * the mentor card (a separate portal API keyed by the student id), the "important message" panel, announcements
 * and notifications. A handful of small calls, a pause between each, none retried.
 */
async function collectProfile(
  start: Page,
  origin: string,
  reportStudentId: string | undefined,
  profile: PortalProfile,
  notes: string[],
) {
  const identity = identityFromDashboard(start.html);
  profile.name = identity.name;
  notes.push(
    `Profile: name ${identity.name ? 'found' : 'not found'}, ${
      identity.photoCandidates.length
    } photo candidate(s)`,
  );

  // Photo: try the likely images in order; log only the shape of each address, never the full link.
  const shape = (url: string) =>
    url.startsWith('data:')
      ? 'inline image'
      : pathOf(url)
          .replace(/\d/g, '9')
          .replace(/[A-Za-z0-9_-]{14,}/g, '*');
  for (const candidate of identity.photoCandidates) {
    await sleep(500);
    try {
      const url = resolveUrl(candidate, start.url);
      const photo = await fetchPhoto(url, start.url);
      notes.push(
        `Profile photo ${shape(url)}: ${
          photo.dataUri ? 'saved' : `skipped (${photo.reason})`
        }`,
      );
      if (photo.dataUri) {
        profile.photo = photo.dataUri;
        break;
      }
    } catch {
      notes.push('Profile photo: could not be downloaded');
    }
  }

  // Mentor: the dashboard may render the card into the page itself; otherwise ask the portal's mentor API,
  // which answers with template values ("value1") when it has nothing real, and those are ignored.
  const section = mentorSectionFromDashboard(start.html);
  let mentor = section ? mentorFromHtml(section) : null;
  let mentorSource = section ? 'dashboard page' : '';
  if (!mentor) {
    const studentId =
      hiddenValueById(start.html, 'hfdfdfds_sid') ?? reportStudentId;
    if (studentId) {
      await sleep(600);
      const query = `StudentMentorDetailView?StudentId=${encodeURIComponent(
        studentId,
      )}`;
      // The portal's own dashboard script calls the plain-http address, so try that first and keep going
      // when an address answers with nothing real (the API answers template values from the wrong host).
      const attempts: string[] = [];
      const apiHost = getCampus().apiHost;
      for (const base of [
        `http://${apiHost}/api/homepage/`,
        `https://${apiHost}/api/homepage/`,
      ]) {
        const scheme = base.startsWith('https') ? 'https' : 'http';
        try {
          const page = await request(`${base}${query}`, {
            json: true,
            referer: start.url,
          });
          attempts.push(`${scheme} ${page.status} ${bodyShape(page.html)}`);
          if (page.status === 200) {
            mentor = mentorFromHtml(mentorHtml(page.html));
            if (mentor) break;
          }
        } catch (err) {
          attempts.push(`${scheme} unreachable (${errorMessage(err)})`);
        }
      }
      mentorSource = `mentor API: ${attempts.join('; ')}`;
    } else {
      mentorSource = 'no student id on the dashboard';
    }
  }
  if (mentor) profile.mentor = mentor;
  notes.push(
    mentor
      ? `Mentor from ${mentorSource}: ${
          mentor.lines.length
        } line(s), recognised: ${
          (['name', 'designation', 'department', 'phone', 'email'] as const)
            .filter(k => mentor[k])
            .join(', ') || 'none'
        }`
      : `Mentor: nothing real to show (${mentorSource || 'no source'})`,
  );

  const post = async (page: string, method: string, body: string) => {
    await sleep(700);
    return request(`${origin}/${page}/${method}`, {
      method: 'POST',
      json: true,
      referer: start.url,
      body,
    });
  };
  const panels: [
    string,
    string,
    string,
    (body: string) => string | null,
    (html: string) => Notice[],
  ][] = [
    [
      'Important messages',
      'DisplayStudentMyMessages',
      '{}',
      messagesHtml,
      html => noticesFromHtml(html, 'MESSAGE', 6),
    ],
    [
      'Announcements',
      'DisplayAnnouncements',
      JSON.stringify({ Category: 'ALL', PageNumber: '1', FilterText: '' }),
      announcementHtml,
      html => announcementsFromHtml(html, 8),
    ],
  ];
  for (const [label, method, body, extract, parse] of panels) {
    try {
      const response = await post('StudentHome.aspx', method, body);
      if (isPortalErrorPage(response.html, response.url)) {
        notes.push(
          `${label}: the portal answered with its error page, so the run stopped here`,
        );
        break;
      }
      const html = response.status === 200 ? extract(response.html) : null;
      const found = html ? parse(html) : [];
      profile.notices.push(...found);
      notes.push(
        `${label}: ${found.length} item(s)${
          response.status === 200 ? '' : ` (status ${response.status})`
        }`,
      );
    } catch {
      notes.push(`${label}: could not be read`);
    }
  }
}

export type DatesheetKind = 'theory' | 'practical';

const DATESHEET_PAGES: { kind: DatesheetKind; path: string }[] = [
  { kind: 'theory', path: 'frmStudentDatesheet.aspx' },
  { kind: 'practical', path: 'frmStudentPracticleDateSheet.aspx' },
];

export type DatesheetPage = {
  kind: DatesheetKind;
  status: number;
  html: string;
  /** True when the portal answered with its error page instead of the date sheet. */
  failed: boolean;
};

async function datesheetMenuPaths(
  start: Page,
): Promise<Partial<Record<DatesheetKind, string>>> {
  try {
    const search = await request(
      `${campusBase()}StudentHome.aspx/DisplayAuthUserSearch`,
      {
        method: 'POST',
        json: true,
        referer: start.url,
        // The portal's own search posts this shape, not strict JSON.
        body: "{SearchKw:'sheet'}",
      },
    );
    const html = htmlFromPageMethod(search.html);
    if (!html) return {};
    const theory = datesheetPathFromMenu(html, 'theory');
    const practical = datesheetPathFromMenu(html, 'practical');
    return {
      ...(theory ? { theory } : {}),
      ...(practical ? { practical } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * Downloads the student's date sheet pages with the saved portal session. Returns `null` when the session has
 * expired (a fresh login is needed first). Looks up the menu href first (it sometimes carries a `type` token),
 * then opens each page; nothing is submitted.
 */
export async function fetchDatesheetPages(): Promise<DatesheetPage[] | null> {
  const start = await resumeSession();
  if (!start) return null;
  await sleep(800);
  const menu = await datesheetMenuPaths(start);
  const pages: DatesheetPage[] = [];
  for (const entry of DATESHEET_PAGES) {
    await sleep(1500);
    const path = menu[entry.kind] ?? entry.path;
    try {
      const page = await request(
        `${campusBase()}${path.replace(/^\.\//, '')}`,
        {
          referer: start.url,
        },
      );
      pages.push({
        kind: entry.kind,
        status: page.status,
        html: page.html,
        failed: page.status !== 200 || isPortalErrorPage(page.html, page.url),
      });
    } catch {
      pages.push({ kind: entry.kind, status: 0, html: '', failed: true });
    }
  }
  return pages;
}

const ID_CARD_BUTTON = 'lbtnDownloadIdCard';
const ID_CARD_TARGET = 'ctl00$ContentPlaceHolder1$lbtnDownloadIdCard';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new CuimsError('Could not read the ID card'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads the student's virtual ID card (a one page PDF) the same way the dashboard's "Download Now" button does.
 * Returns the PDF as base64, or `null` when the saved session has expired. One page load and one button press.
 */
export async function fetchVirtualIdCard(): Promise<string | null> {
  const home = await resumeSession();
  if (!home) return null;
  if (!home.html.includes(ID_CARD_BUTTON)) {
    throw new CuimsError(
      'CUIMS is not offering a virtual ID card for your account right now.',
    );
  }
  await sleep(1200);
  const response = await fetch(`${campusBase()}StudentHome.aspx`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Referer: home.url,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formEncode({
      ...hiddenFields(home.html),
      __EVENTTARGET: ID_CARD_TARGET,
      __EVENTARGUMENT: '',
    }),
  });
  if (!/pdf/i.test(response.headers.get('content-type') ?? '')) {
    throw new CuimsError(
      'The portal did not return your ID card. Try again in a moment.',
    );
  }
  const base64 = await blobToBase64(await response.blob());
  // Every PDF starts with "%PDF", which is "JVBER" in base64.
  if (!base64.startsWith('JVBER')) {
    throw new CuimsError('The portal sent an ID card that could not be read.');
  }
  return base64;
}
