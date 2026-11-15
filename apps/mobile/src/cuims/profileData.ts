import { decodeEntities } from './htmlTables';
import { parseAttDate } from './portalData';

/**
 * Pure parsers for the student's own dashboard: name, photo address, mentor card and the message / announcement /
 * notification panels. The panels are filled by the portal's own AJAX calls, whose markup is only loosely
 * structured, so everything here is tolerant: it reads list items or table rows and falls back to plain lines.
 */

export type Mentor = {
  name?: string;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
  /** The card's visible lines (labels and values), so nothing is lost when a field is not recognised. */
  lines: string[];
};

export type NoticeKind = 'MESSAGE' | 'ANNOUNCEMENT' | 'NOTIFICATION';

export type Notice = {
  kind: NoticeKind;
  title: string;
  body?: string;
  date?: string;
};

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Visible text as separate lines; table cells on one row are joined with " | ". */
export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(
      /<(?:br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/ul|\/ol|\/table|\/label|\/span)\b[^>]*>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .split('\n')
    .map(line =>
      clean(line)
        .replace(/(\s*\|\s*)+$/g, '')
        .replace(/^(\s*\|\s*)+/g, ''),
    )
    .filter(line => line.length > 0);
}

export function hiddenValueById(html: string, id: string): string | undefined {
  for (const tag of html.matchAll(/<input\b[^>]*>/gi)) {
    const attrs = tag[0];
    const named = new RegExp(
      `(?:id|name)\\s*=\\s*["'][^"']*${id}["']`,
      'i',
    ).test(attrs);
    if (!named) continue;
    const value = /value\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1];
    if (value) return decodeEntities(value).trim();
  }
  return undefined;
}

const pairFromLine = (line: string): [string, string] | null => {
  if (line.includes(' | ')) {
    const parts = line.split(' | ').map(clean).filter(Boolean);
    if (parts.length >= 2 && parts[0] && parts[0].length <= 40)
      return [parts[0].replace(/\s*:\s*$/, ''), parts.slice(1).join(' ')];
  }
  const m = /^([A-Za-z][A-Za-z .\/&()'-]{1,40}?)\s*:\s*(.+)$/.exec(line);
  return m?.[1] && m[2] ? [m[1], m[2]] : null;
};

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(?:\+?\d[\d\s-]{8,14}\d)/;

/** The mentor API of the portal answers with template values ("value1", "value2") when it has nothing real. */
export const isPlaceholderLine = (line: string) =>
  /^(value\s*\d*|string|null|undefined|n\/?a|-+)$/i.test(line.trim());

/** The contents of the element with this tag name that opens at `from`, up to its matching close tag. */
function elementBody(html: string, tag: string, from: number): string {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(from, m.index);
  }
  return html.slice(from, from + 4000);
}

const hasRealText = (section: string) =>
  htmlToLines(section).some(line => !isPlaceholderLine(line));

/**
 * The mentor block of the dashboard page itself. The portal renders it into the page (a box whose id ends in
 * `divStudentMentorDetails`); older layouts only have a "Mentor Details" heading followed by the details.
 */
export function mentorSectionFromDashboard(html: string): string | null {
  const box =
    /<(\w+)\b[^>]*\bid\s*=\s*["'][^"']*divStudentMentorDetails["'][^>]*>/i.exec(
      html,
    );
  if (box) {
    const section = elementBody(
      html,
      box[1] ?? 'div',
      box.index + box[0].length,
    );
    if (hasRealText(section)) return section;
  }
  const heading =
    /<(h\d|div|span|strong|label|p|a|b)\b[^>]*>(?:\s*<[^>]+>)*\s*Mentor\s+Details?\s*<\/\1>/i.exec(
      html,
    );
  if (!heading) return null;
  const rest = html.slice(
    heading.index + heading[0].length,
    heading.index + heading[0].length + 4000,
  );
  const end = rest.search(
    /<h[1-6]\b|class\s*=\s*["'][^"']*(?:panel-heading|card-header|widget-title|box-title)/i,
  );
  const section = end > 0 ? rest.slice(0, end) : rest;
  return hasRealText(section) ? section : null;
}

export function mentorFromHtml(html: string): Mentor | null {
  const lines = htmlToLines(html).filter(
    line =>
      !/^(nothing found\.?|loading\.*|mentor details?)$/i.test(line) &&
      !isPlaceholderLine(line),
  );
  if (lines.length === 0) return null;
  const mentor: Mentor = {
    lines: lines.slice(0, 12).map(line => line.slice(0, 120)),
  };

  const pairs: [string, string][] = [];
  lines.forEach((line, index) => {
    const pair = pairFromLine(line);
    if (pair) pairs.push(pair);
    else if (/:\s*$/.test(line) && lines[index + 1])
      pairs.push([line.replace(/\s*:\s*$/, ''), lines[index + 1] ?? '']);
  });
  for (const [label, value] of pairs) {
    if (!mentor.name && /name/i.test(label))
      mentor.name = value.replace(/\s*\([A-Za-z]?\d+\)\s*$/, '').slice(0, 80);
    else if (!mentor.designation && /designation|post|role/i.test(label))
      mentor.designation = value.slice(0, 80);
    else if (
      !mentor.department &&
      /department|school|dept|college/i.test(label)
    )
      mentor.department = value.slice(0, 80);
    else if (
      !mentor.phone &&
      /mobile|phone|contact|cell/i.test(label) &&
      PHONE.test(value)
    )
      mentor.phone = PHONE.exec(value)?.[0]?.replace(/\s+/g, '');
    else if (!mentor.email && /e-?mail/i.test(label) && EMAIL.test(value))
      mentor.email = EMAIL.exec(value)?.[0];
  }
  mentor.email ??= EMAIL.exec(lines.join(' '))?.[0];
  mentor.name ??= lines.find(
    line =>
      !pairFromLine(line) &&
      !EMAIL.test(line) &&
      !PHONE.test(line) &&
      line.length <= 60 &&
      /[A-Za-z]{3}/.test(line),
  );
  return mentor;
}

const DATE_LINE = /^\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}$/;
const TIME_LINE = /^\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?$/i;
/** Section labels such as "Leave Message" / "Other Message" that have no content of their own. */
const LABEL_ONLY = /^[A-Za-z ]{0,24}messages?$/i;

/** "1. Pending Documents: The status of ..." becomes a short title plus the rest as the body. */
function splitTitle(
  title: string,
  body: string,
): { title: string; body: string } {
  const colon = title.indexOf(':');
  if (title.length > 70 && colon > 3 && colon <= 60) {
    return {
      title: title
        .slice(0, colon)
        .replace(/^\d+\s*[.)]\s*/, '')
        .trim(),
      body: `${title.slice(colon + 1).trim()} ${body}`.trim(),
    };
  }
  return { title: title.replace(/^\d+\s*[.)]\s+(?=[A-Za-z])/, ''), body };
}

const SKIP_NOTICE =
  /^(view all|read more|more|loading\.*|no (?:record|data|message|announcement|notification)s?.*|close|refresh)$/i;

/** One notice per list item (or table row); plain lines when the markup has neither. */
export function noticesFromHtml(
  html: string,
  kind: NoticeKind,
  limit = 12,
): Notice[] {
  let blocks = Array.from(html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).map(
    m => m[1] ?? '',
  );
  if (blocks.length === 0)
    blocks = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map(
      m => m[1] ?? '',
    );
  if (blocks.length === 0) blocks = htmlToLines(html);

  const seen = new Set<string>();
  const notices: Notice[] = [];
  for (const block of blocks) {
    const lines = htmlToLines(block);
    const rawTitle = lines[0] ? clean(lines[0]) : '';
    if (
      rawTitle.length < 3 ||
      SKIP_NOTICE.test(rawTitle) ||
      seen.has(rawTitle.toLowerCase())
    )
      continue;
    if (lines.length === 1 && LABEL_ONLY.test(rawTitle)) continue;
    seen.add(rawTitle.toLowerCase());
    const text = lines.join(' ');
    const dateText =
      /(\d{1,2}(?:st|nd|rd|th)?[\s\-/.](?:[A-Za-z]{3,9}|\d{1,2})[\s\-/.,]+\d{4})/.exec(
        text,
      )?.[1];
    const split = splitTitle(rawTitle, lines.slice(1).join(' '));
    notices.push({
      kind,
      title: split.title.slice(0, 160),
      body: split.body.slice(0, 400) || undefined,
      date: dateText ? parseAttDate(dateText) ?? undefined : undefined,
    });
    if (notices.length >= limit) break;
  }
  return notices;
}

/**
 * Announcements: each one is a date line, a time line, then its text (often a list of rules, which must not be
 * split into separate notices). Falls back to list items when the page shows no date lines.
 */
export function announcementsFromHtml(html: string, limit = 10): Notice[] {
  const lines = htmlToLines(html);
  if (!lines.some(line => DATE_LINE.test(line)))
    return noticesFromHtml(html, 'ANNOUNCEMENT', limit);
  const groups: { date?: string; lines: string[] }[] = [];
  for (const line of lines) {
    if (DATE_LINE.test(line))
      groups.push({ date: parseAttDate(line) ?? undefined, lines: [] });
    else if (TIME_LINE.test(line) || SKIP_NOTICE.test(line)) continue;
    else
      (
        groups[groups.length - 1] ?? groups[groups.push({ lines: [] }) - 1]
      )?.lines.push(clean(line));
  }
  return groups
    .filter(group => group.lines.length > 0)
    .slice(0, limit)
    .map(group => {
      const split = splitTitle(
        group.lines[0] ?? '',
        group.lines.slice(1).join(' '),
      );
      return {
        kind: 'ANNOUNCEMENT' as const,
        title: split.title.slice(0, 160),
        body: split.body.slice(0, 400) || undefined,
        date: group.date,
      };
    });
}

/** `d` of the announcements call: "<intro>--IsNewAnnouncement--<flag>--IsNewAnnouncement--<html>". */
export function announcementHtml(body: string): string | null {
  const d = pageMethodString(body);
  if (d === null || d === '0') return null;
  const parts = d.split('--IsNewAnnouncement--');
  const html = parts[2] ?? parts[0] ?? '';
  const start = html.indexOf('<div id="div_Announcements">');
  return start >= 0 ? html.slice(start) : html;
}

/** `d` of the my-messages call: "<1|0>----StudentMyMessages----<html>----StudentMyMessages----<flag>". */
export function messagesHtml(body: string): string | null {
  const d = pageMethodString(body);
  if (!d) return null;
  const parts = d.split('----StudentMyMessages----');
  if (parts[0] !== '1') return null;
  const html = parts[1] ?? '';
  const start = html.indexOf('<div class="divStudentMyMessages">');
  return start >= 0 ? html.slice(start) : html;
}

export function notificationsHtml(body: string): string | null {
  const d = pageMethodString(body);
  if (!d) return null;
  const start = d.indexOf('<div class="div_Notifications">');
  return start >= 0 ? d.slice(start) : d;
}

export function pageMethodString(body: string): string | null {
  try {
    const outer = JSON.parse(body) as { d?: unknown };
    return typeof outer.d === 'string' ? outer.d : null;
  } catch {
    return null;
  }
}

/** The mentor endpoint returns a JSON string holding an HTML fragment. */
export function mentorHtml(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object') {
      return (
        Array.isArray(parsed)
          ? parsed
          : Object.values(parsed as Record<string, unknown>)
      )
        .filter((v): v is string => typeof v === 'string')
        .join('\n');
    }
  } catch {
    // not JSON: use as is
  }
  return body;
}

/**
 * The portal labels its inline photo `image/png` even when the bytes are a JPEG. Name the real type from the first
 * bytes, so the image is stored and shown correctly. Returns null for anything that is not a base64 image.
 */
export function normalizeImageDataUri(uri: string): string | null {
  const match = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(uri);
  const data = match?.[1]?.replace(/\s+/g, '');
  if (!data) return null;
  const mime = data.startsWith('/9j/')
    ? 'jpeg'
    : data.startsWith('iVBOR')
    ? 'png'
    : data.startsWith('R0lGOD')
    ? 'gif'
    : data.startsWith('UklGR')
    ? 'webp'
    : null;
  return mime ? `data:image/${mime};base64,${data}` : null;
}

export type DashboardIdentity = {
  name?: string;
  photoSrc?: string;
  photoCandidates: string[];
};

/** Name and photo address from the dashboard header (the markup is matched loosely on ids / classes). */
export function identityFromDashboard(html: string): DashboardIdentity {
  const identity: DashboardIdentity = { photoCandidates: [] };
  const nameTag =
    /<(?:span|div|label|p|h\d|a)\b[^>]*(?:id|class)\s*=\s*["'][^"']*(?:lblStudentName|lblUserName|lblName|user-n-mob|user-name|username|stu-name)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|label|p|h\d|a)>/i.exec(
      html,
    );
  if (nameTag?.[1]) {
    const lines = htmlToLines(nameTag[1]).filter(
      line => /[A-Za-z]{2}/.test(line) && !/^\d/.test(line),
    );
    if (lines[0]) identity.name = lines[0].slice(0, 80);
  }
  const ranked: { src: string; score: number }[] = [];
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = tag[0];
    const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (
      !src ||
      /logo|loader|banner|sprite|icon|blank|spacer|\.gif(\?|$)|\.svg(\?|$)/i.test(
        src,
      )
    )
      continue;
    const score =
      (/(?:profile|photo|student|stu)/i.test(attrs) ? 2 : 0) +
      (/(?:user|pic|avatar)/i.test(attrs) ? 1 : 0) +
      (/^data:image\//i.test(src) ? 3 : 0);
    ranked.push({ src: decodeEntities(src), score });
  }
  ranked.sort((a, b) => b.score - a.score);
  identity.photoCandidates = Array.from(
    new Set(ranked.filter(r => r.score > 0).map(r => r.src)),
  ).slice(0, 4);
  identity.photoSrc = identity.photoCandidates[0];
  return identity;
}
