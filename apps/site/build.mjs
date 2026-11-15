// Builds the static Rilvona site into dist/: landing page, /privacy and /terms.
// The legal text is read from the app's own source (apps/mobile/src/screens/academics/legal.ts), so the website and
// the in-app screens can never say different things.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('../../node_modules/typescript');
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const ORIGIN = 'https://rilvona.com';

const legalSource = await readFile(path.join(here, '../mobile/src/screens/academics/legal.ts'), 'utf8');
const { outputText } = ts.transpileModule(legalSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const legalModule = { exports: {} };
new Function('module', 'exports', outputText)(legalModule, legalModule.exports);
const { LEGAL } = legalModule.exports;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const css = await readFile(path.join(here, 'style.css'), 'utf8');

const head = ({ title, description, path: p }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0f0f10">
<link rel="canonical" href="${ORIGIN}${p}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${ORIGIN}/icon-512.png">
<meta property="og:url" content="${ORIGIN}${p}">
<meta property="og:type" content="website">
<style>${css}</style>
</head>`;

const footer = `<footer>
  <nav><a href="/">Home</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms and conditions</a></nav>
  <p>Rilvona is an independent app for students. It is not owned, run, sponsored or endorsed by Chandigarh University.</p>
</footer>`;

const features = [
  ['Live attendance', 'Your real numbers from the university portal, subject by subject, with how many classes you can still skip.', '#34c759'],
  ['Attendance prediction', 'Slide to a date and see where your overall percentage ends up, and what to attend to stay safe.', '#ff9f0a'],
  ['Timetable', 'Today’s classes with time, room and teacher, and a live “class now” card.', '#3b9be8'],
  ['Marks', 'Your internal marks and averages in one clean view.', '#a374ff'],
  ['Date sheet', 'Your exam dates, timings and venues with a countdown to the next paper.', '#ff453a'],
  ['Academic calendar', 'Holidays, breaks and teaching days, so you can plan the semester.', '#f08a3e'],
];

const landing = `${head({
  title: 'Rilvona – your smart companion for university life',
  description: 'Rilvona shows your attendance, timetable, marks, date sheet and academic calendar in one clean app, and helps you plan how many classes you can skip.',
  path: '/',
})}
<body>
<div class="glow g1"></div><div class="glow g2"></div>
<main>
  <section class="hero">
    <img class="logo" src="/logo.png" width="160" height="160" alt="Rilvona logo">
    <h1>Rilvona</h1>
    <p class="tag">Your smart companion for university life</p>
    <p class="lead">Attendance, timetable, marks, date sheet and the academic calendar in one clean app, with the maths done for you.</p>
    <div class="cta"><span class="badge">Coming soon on Google Play</span></div>
  </section>
  <section class="features">
${features
  .map(
    ([t, d, c]) =>
      `    <article style="--c:${c}"><span class="dot"></span><h2>${esc(t)}</h2><p>${esc(d)}</p></article>`,
  )
  .join('\n')}
  </section>
  <section class="privacy-note">
    <h2>Your password stays on your phone</h2>
    <p>You sign in to Rilvona with Google, so there is no Rilvona password. Your university password is kept in your phone’s secure keychain and is sent only to the university’s own server. The sign in captcha is always shown to you to solve yourself. Read the <a href="/privacy">privacy policy</a> and the <a href="/terms">terms</a>.</p>
  </section>
</main>
${footer}
</body>
</html>
`;

const legalPage = (kind, p) => {
  const doc = LEGAL[kind];
  return `${head({ title: `${doc.title} – Rilvona`, description: doc.intro, path: p })}
<body class="doc">
<header class="bar"><a href="/" class="brand"><img src="/icon-192.png" width="32" height="32" alt=""> Rilvona</a></header>
<main class="legal">
  <h1>${esc(doc.title)}</h1>
  <p class="updated">Updated ${esc(doc.updated)}</p>
  <p>${esc(doc.intro)}</p>
${doc.sections
  .map(
    (s, i) =>
      `  <h2>${i + 1}. ${esc(s.heading)}</h2>\n${s.body.map((b) => `  <p>${esc(b)}</p>`).join('\n')}`,
  )
  .join('\n')}
  <h2>Contact</h2>
  <p>Questions about this ${kind === 'terms' ? 'document' : 'policy'} or about your data: use the support contact shown on Rilvona’s Google Play page.</p>
</main>
${footer}
</body>
</html>
`;
};

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'privacy'), { recursive: true });
await mkdir(path.join(dist, 'terms'), { recursive: true });
await cp(path.join(here, 'public'), dist, { recursive: true });
await writeFile(path.join(dist, 'index.html'), landing);
await writeFile(path.join(dist, 'privacy', 'index.html'), legalPage('privacy', '/privacy'));
await writeFile(path.join(dist, 'terms', 'index.html'), legalPage('terms', '/terms'));
await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
await writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', '/privacy', '/terms']
    .map((u) => `  <url><loc>${ORIGIN}${u === '/' ? '' : u}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);
console.log('built', dist);
