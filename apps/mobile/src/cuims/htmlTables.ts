/**
 * Small, dependency-free HTML helpers for reading the pages a student is
 * already logged in to. React Native has no DOM, so this works on strings.
 */

export type RawTable = {
  caption?: string;
  headers: string[];
  rows: string[][];
};
export type PageLink = { href: string; text: string };

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1]?.toLowerCase() === 'x'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

export function textOf(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Finds tables that contain no other table (layout tables are skipped). */
export function extractTables(html: string): RawTable[] {
  const tokens: { open: boolean; index: number; end: number }[] = [];
  const re = /<(\/?)table\b[^>]*>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    tokens.push({
      open: m[1] !== '/',
      index: m.index,
      end: m.index + m[0].length,
    });
  }
  const stack: { index: number; end: number; hasChild: boolean }[] = [];
  const innermost: { start: number; end: number; closeStart: number }[] = [];
  for (const token of tokens) {
    if (token.open) {
      const parent = stack[stack.length - 1];
      if (parent) parent.hasChild = true;
      stack.push({ index: token.index, end: token.end, hasChild: false });
    } else {
      const open = stack.pop();
      if (open && !open.hasChild)
        innermost.push({
          start: open.end,
          end: token.end,
          closeStart: token.index,
        });
    }
  }

  const tables: RawTable[] = [];
  for (const span of innermost) {
    const inner = html.slice(span.start, span.closeStart);
    const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(inner)?.[1];
    const rows: string[][] = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    for (let r = rowRe.exec(inner); r; r = rowRe.exec(inner)) {
      const cells: string[] = [];
      const cellRe = /<t([hd])\b[^>]*>([\s\S]*?)<\/t\1>/gi;
      for (let c = cellRe.exec(r[1] ?? ''); c; c = cellRe.exec(r[1] ?? '')) {
        cells.push(textOf(c[2] ?? '').slice(0, 300));
      }
      if (cells.length > 0) rows.push(cells.slice(0, 40));
    }
    if (rows.length < 2) continue;
    const [headers, ...body] = rows;
    const data = body.filter(row => row.length > 1).slice(0, 300);
    if (!headers || data.length === 0) continue;
    tables.push({
      caption: caption ? textOf(caption).slice(0, 200) : undefined,
      headers: headers.map(h => h.slice(0, 200)),
      rows: data,
    });
  }
  return tables.slice(0, 25);
}

export function extractLinks(html: string): PageLink[] {
  const links: PageLink[] = [];
  const re =
    /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const href = decodeEntities(m[1] ?? m[2] ?? '').trim();
    const text = textOf(m[3] ?? '');
    if (
      !href ||
      href.startsWith('#') ||
      /^(javascript|mailto|tel):/i.test(href)
    )
      continue;
    links.push({ href, text: text.slice(0, 120) });
  }
  return links;
}

export function hiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const re = /<input\b[^>]*>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const tag = m[0];
    if (!/type\s*=\s*["']hidden["']/i.test(tag)) continue;
    const name = /name\s*=\s*"([^"]*)"/i.exec(tag)?.[1];
    if (!name) continue;
    fields[name] = decodeEntities(
      /value\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? '',
    );
  }
  return fields;
}

export function resolveUrl(href: string, base: string): string {
  if (/^https?:\/\//i.test(href) || /^data:/i.test(href)) return href;
  const origin = /^(https?:\/\/[^/]+)/i.exec(base)?.[1] ?? '';
  if (href.startsWith('//')) return `${origin.split(':')[0]}:${href}`;
  if (href.startsWith('/')) return origin + href;
  const pathPart = href.split(/[?#]/)[0] ?? '';
  const rest = href.slice(pathPart.length);
  const basePath = base.slice(origin.length).split(/[?#]/)[0] || '/';
  const segments = basePath.split('/').slice(0, -1);
  for (const part of pathPart.split('/')) {
    if (part === '..') {
      if (segments.length > 1) segments.pop();
    } else if (part !== '.' && part !== '') {
      segments.push(part);
    }
  }
  return origin + segments.join('/') + rest;
}

export function formEncode(values: Record<string, string>): string {
  return Object.entries(values)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
}

export type PageStructure = {
  title: string;
  headings: string[];
  forms: string[];
  controls: string[];
  scripts: string[];
  endpoints: string[];
  postbacks: string[];
  gridHints: string[];
  menuHints: string[];
};

/**
 * Describes how a page is built (controls, scripts, endpoints) without copying
 * any values from it, so a page that renders no table can be understood.
 */
export function describePage(html: string): PageStructure {
  const uniq = (items: string[], max: number) =>
    Array.from(new Set(items)).slice(0, max);
  const controls: string[] = [];
  for (const m of html.matchAll(/<(input|select|textarea|button)\b[^>]*>/gi)) {
    const tag = m[0];
    const name =
      /\bname\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ??
      /\bid\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ??
      '';
    const type =
      /\btype\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? m[1]?.toLowerCase() ?? '';
    if (!name || type === 'hidden' || /^__/.test(name)) continue;
    controls.push(`${m[1]?.toLowerCase()}:${type}:${name}`);
  }
  for (const m of html.matchAll(
    /<select\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi,
  )) {
    const options = Array.from(
      (m[2] ?? '').matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi),
    )
      .map(o => textOf(o[1] ?? ''))
      .slice(0, 8);
    controls.push(`options(${m[1]}):${options.join(' | ')}`);
  }
  const scripts = Array.from(
    html.matchAll(/<script\b[^>]*\bsrc\s*=\s*"([^"]*)"/gi),
  ).map(m => (m[1] ?? '').split('?')[0] ?? '');
  const inline = Array.from(
    html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  )
    .map(m => m[1] ?? '')
    .join('\n');
  const endpoints = Array.from(
    inline.matchAll(
      /(?:url\s*:\s*|fetch\(|open\(\s*["'][A-Z]+["']\s*,\s*|PageMethods\.|location(?:\.href)?\s*=\s*)["']?([^"'\s,)]{3,120})/gi,
    ),
  ).map(m => m[1] ?? '');
  const postbacks = Array.from(
    html.matchAll(/__doPostBack\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/g),
  ).map(m => `${m[1]}(${m[2]})`);
  const gridHints = [
    'GridView',
    'kendo',
    'DataTable',
    'dataTables',
    'ag-grid',
    'UpdatePanel',
    'ScriptManager',
    'rptr',
    'Repeater',
    'chart',
    'modal',
  ].filter(hint => html.includes(hint));
  return {
    title: textOf(
      /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '',
    ).slice(0, 100),
    headings: uniq(
      Array.from(html.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi))
        .map(m => textOf(m[1] ?? '').slice(0, 80))
        .filter(Boolean),
      10,
    ),
    forms: uniq(
      Array.from(html.matchAll(/<form\b[^>]*\saction="([^"]*)"/gi)).map(
        m => (m[1] ?? '').split('?')[0] ?? '',
      ),
      4,
    ),
    controls: uniq(controls, 30),
    scripts: uniq(scripts, 15),
    endpoints: uniq(endpoints, 15),
    postbacks: uniq(postbacks, 12),
    gridHints,
    menuHints: uniq(
      inline
        .split(/\n|;/)
        .map(line => line.trim())
        .filter(line => /menu|sidebar|nav/i.test(line) && line.length < 400)
        .map(line => line.slice(0, 140)),
      6,
    ),
  };
}

const SAFE_FIELD =
  /^(uid|student\s*name|program(\s*name)?|status|over\s*all\s*attendance)\s*:?$/i;
const PROFILE_FIELD =
  /^(account\s*no|uid|status|student\s*name|father('s)?\s*name|mother('s)?\s*name|mobile(\s*no)?|dob|date\s*of\s*birth|program(\s*name)?|over\s*all\s*attendance|email|address|aadhaar|gender)\s*:?$/i;
const LEAVE_HEADER =
  /from\s*date|to\s*date|remarks|leave\s*(type|status|id|history)/i;

/**
 * Privacy filter applied on the device before anything is logged or sent to Rilvona.
 * Profile-style "label | value" tables keep only UID, name, program, status and overall attendance
 * (father's name, mobile, DOB, account number and so on are dropped), and leave-history tables are dropped.
 */
export function sanitizeTables(tables: RawTable[]): RawTable[] {
  const out: RawTable[] = [];
  for (const table of tables) {
    const all = [table.headers, ...table.rows];
    const labelled = all.filter(row =>
      PROFILE_FIELD.test((row[0] ?? '').trim()),
    ).length;
    if (labelled >= 2) {
      const safe = all
        .filter(row => SAFE_FIELD.test((row[0] ?? '').trim()))
        .map(row => [row[0] ?? '', row[1] ?? '']);
      if (safe.length >= 2)
        out.push({
          caption: table.caption,
          headers: ['Field', 'Value'],
          rows: safe,
        });
      continue;
    }
    if (table.headers.some(h => LEAVE_HEADER.test(h))) continue;
    out.push(table);
  }
  return out;
}
