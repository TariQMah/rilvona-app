// Builds the static Rilvona site into dist/: landing page, /privacy and /terms.
// The legal text is read from the app's own source (apps/mobile/src/screens/academics/legal.ts), so the website and
// the in-app screens can never say different things.
// The download button reads release.json (written by publish-apk.mjs): version, size and SHA-256 of the hosted APK.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('../../node_modules/typescript');
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const ORIGIN = 'https://rilvona.com';
const REPO = 'https://github.com/dixitk941/rilvona-app';
const APK_STABLE_URL = '/download/rilvona.apk';

const legalSource = await readFile(path.join(here, '../mobile/src/screens/academics/legal.ts'), 'utf8');
const { outputText } = ts.transpileModule(legalSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const legalModule = { exports: {} };
new Function('module', 'exports', outputText)(legalModule, legalModule.exports);
const { LEGAL } = legalModule.exports;

let release = null;
try {
  release = JSON.parse(await readFile(path.join(here, 'release.json'), 'utf8'));
} catch {
  console.warn('release.json not found: the download button will have no version details');
}

// Buttons link to the versioned file: Cloudflare caches /download/ for hours, so a fixed name could serve an old APK
// next to a new checksum. rilvona.apk stays as an always-latest alias for people who bookmark it.
const APK_URL = release ? `/download/rilvona-${release.version}.apk` : APK_STABLE_URL;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const css = await readFile(path.join(here, 'style.css'), 'utf8');
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

const head = ({ title, description, path: p, extra = '' }) => `<!doctype html>
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
<meta name="twitter:card" content="summary">
${extra}<style>${css}</style>
</head>`;

const icon = {
  download:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
  android:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.5 8.6 19 6a.5.5 0 1 0-.87-.5l-1.52 2.65A9.3 9.3 0 0 0 12 7.2c-1.7 0-3.3.4-4.6 1l-1.5-2.7A.5.5 0 0 0 5 6l1.5 2.6A7.7 7.7 0 0 0 3 15h18a7.7 7.7 0 0 0-3.5-6.4ZM8.5 12.6a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Zm7 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8ZM3 16.2v.6a1.4 1.4 0 0 0 1.4 1.4h.7v2.4a1.2 1.2 0 0 0 2.4 0v-2.4h1.3v2.4a1.2 1.2 0 0 0 2.4 0v-2.4h1.6v2.4a1.2 1.2 0 0 0 2.4 0v-2.4h1.3v2.4a1.2 1.2 0 0 0 2.4 0v-2.4h.7A1.4 1.4 0 0 0 21 16.8v-.6H3Z"/></svg>',
};

const downloadButton = (where) => `<a class="btn primary" href="${APK_URL}" download data-track="${where}">${icon.download}<span><b>Download APK</b>${
  release ? `<small>v${esc(release.version)} · ${mb(release.sizeBytes)} · Android ${esc(release.minAndroid)}+</small>` : ''
}</span></a>`;

const features = [
  ['Live attendance', 'Your real numbers from the university portal, subject by subject, with how many classes you can still skip.', '#34c759'],
  ['Class planner', 'Slide to a date and see where your overall percentage ends up, and exactly which classes to attend to stay safe.', '#ff9f0a'],
  ['Timetable', 'Today’s classes with time, room and teacher, plus a live “class now” card.', '#3b9be8'],
  ['Marks and results', 'Internal marks, averages and results in one clean view.', '#a374ff'],
  ['Date sheet', 'Exam dates, timings and venues, with a countdown to your next paper.', '#ff453a'],
  ['Academic calendar', 'Holidays, breaks and teaching days, so you can plan the whole semester.', '#f08a3e'],
  ['AI study assistant', 'Ask “Which subjects are at risk?” or “Can I skip tomorrow?” and get an answer from your own data.', '#5ac8fa'],
  ['Virtual ID card', 'Your university ID card on your phone, saved for when you need it.', '#ffd60a'],
  ['Campus community', 'Hives, posts, events and anonymous questions with students from your college.', '#ff6bb5'],
];

const steps = [
  ['Install', 'Download the APK and open it. Android will ask you to allow installs from your browser once.'],
  ['Sign in with Google', 'No new password to remember. Rilvona never sees your Google password.'],
  ['Link your university portal', 'Add your portal login once. It stays in your phone’s secure keychain.'],
  ['You’re done', 'Attendance, timetable, marks and dates are ready, and refresh whenever you open the app.'],
];

const faqs = [
  [
    'Why isn’t Rilvona on the Play Store?',
    'We distribute Rilvona directly so updates reach you without waiting on a store review. The app is open source, and the file you download here is the same build we run ourselves.',
  ],
  [
    'Is it safe to install an APK?',
    `Only install APKs from sources you trust, and check the file first. Each release lists its SHA-256 checksum on this page, and the full source code is public on <a href="${REPO}">GitHub</a> for anyone to read.`,
  ],
  [
    'Which phones does it support?',
    `Android ${release ? esc(release.minAndroid) : '7.0'} and newer, on 64-bit and 32-bit ARM phones, which is almost every Android phone sold in the last decade. There is no iPhone version yet.`,
  ],
  [
    'How do I update?',
    'Come back to this page and download the newest APK, then open it. It installs over the old version and keeps your data.',
  ],
  [
    'Is my university password safe?',
    'It is kept in your phone’s secure keychain and is sent only to the university’s own server. The sign-in captcha is always shown to you to solve yourself. Read the <a href="/privacy">privacy policy</a> for details.',
  ],
  [
    'Is Rilvona official?',
    'No. Rilvona is an independent app made by and for students. It is not owned, run, sponsored or endorsed by Chandigarh University.',
  ],
];

const faqJson = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') },
  })),
};
const appJson = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Rilvona',
  operatingSystem: 'Android',
  applicationCategory: 'EducationalApplication',
  ...(release ? { softwareVersion: release.version, fileSize: mb(release.sizeBytes) } : {}),
  downloadUrl: `${ORIGIN}${APK_URL}`,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
};

const subjects = [
  ['Data Structures', 91, '#34c759'],
  ['Operating Systems', 84, '#34c759'],
  ['Discrete Maths', 77, '#ff9f0a'],
  ['Computer Networks', 68, '#ff453a'],
];

const phoneHome = `<div class="phone" role="img" aria-label="Rilvona attendance screen showing 82 percent overall attendance with a list of subjects">
  <div class="notch"></div>
  <div class="screen">
    <p class="s-hello">Good morning</p>
    <p class="s-title">Attendance</p>
    <div class="ringwrap"><div class="ring" style="--p:82"><div><b>82%</b><span>overall</span></div></div>
      <p class="s-note"><b>6</b> classes you can still skip</p></div>
    <ul class="subj">
${subjects
  .map(
    ([n, v, c]) =>
      `      <li><div><span>${n}</span><b style="color:${c}">${v}%</b></div><i><u style="width:${v}%;background:${c}"></u></i></li>`,
  )
  .join('\n')}
    </ul>
  </div>
</div>`;

const phonePlan = `<div class="phone small" role="img" aria-label="Rilvona class planner showing predicted attendance if you skip classes next week">
  <div class="notch"></div>
  <div class="screen">
    <p class="s-hello">Class planner</p>
    <p class="s-title">If you skip 3 classes</p>
    <div class="predict"><div><span>Now</span><b>82%</b></div><div class="arrow">→</div><div class="up"><span>On 5 Dec</span><b>79%</b></div></div>
    <div class="slider"><i></i><u></u></div>
    <p class="s-note">Still above the <b>75%</b> limit. Attend <b>Networks</b> on Monday to stay safe.</p>
    <ul class="subj">
      <li><div><span>Computer Networks</span><b style="color:#ff453a">Attend all</b></div><i><u style="width:68%;background:#ff453a"></u></i></li>
      <li><div><span>Discrete Maths</span><b style="color:#ff9f0a">Can skip 1</b></div><i><u style="width:77%;background:#ff9f0a"></u></i></li>
    </ul>
  </div>
</div>`;

// Served as /app.js because the site's Content-Security-Policy only allows scripts from its own origin.
const APP_JS = `(function(){
  var ua=navigator.userAgent, note=document.getElementById('platform-note');
  if(!/Android/i.test(ua)){
    note.hidden=false;
    note.textContent=/iPhone|iPad|iPod/i.test(ua)
      ? 'Rilvona is Android only for now. There is no iPhone version yet.'
      : 'Opening this on a computer? Open rilvona.com on your Android phone to install, or send it the link.';
  }
  document.querySelectorAll('[data-copy]').forEach(function(b){
    b.addEventListener('click',function(){
      var t=document.getElementById(b.getAttribute('data-copy')).textContent;
      (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy checksum'},1800)},function(){});
    });
  });
})();
`;

const landing = `${head({
  title: 'Rilvona – attendance, timetable and marks in one app | Download for Android',
  description:
    'Rilvona shows your university attendance, timetable, marks, date sheet and academic calendar in one clean app, and tells you how many classes you can skip. Free Android APK, no Play Store needed.',
  path: '/',
  extra: `<script type="application/ld+json">${JSON.stringify(appJson)}</script>\n<script type="application/ld+json">${JSON.stringify(faqJson)}</script>\n`,
})}
<body class="home">
<div class="glows" aria-hidden="true"><div class="glow g1"></div><div class="glow g2"></div></div>
<header class="nav">
  <a href="/" class="brand"><img src="/icon-192.png" width="34" height="34" alt=""> Rilvona</a>
  <nav>
    <a href="#features">Features</a><a href="#how">How it works</a><a href="#install">Install</a><a href="#faq">FAQ</a>
  </nav>
  <a class="btn small" href="#download">Download</a>
</header>
<main>
  <section class="hero" id="download">
    <div class="hero-copy">
      <p class="eyebrow">${icon.android} Free for Android · Direct APK</p>
      <h1>Your smart companion for <span class="grad">university life</span></h1>
      <p class="lead">Attendance, timetable, marks, date sheet and the academic calendar in one clean app, with the maths done for you. Know exactly how many classes you can skip.</p>
      <div class="cta">
        ${downloadButton('hero')}
        <a class="btn ghost" href="${REPO}">${icon.github}<span><b>View source</b></span></a>
      </div>
      <p class="notice" id="platform-note" hidden></p>
      <ul class="chips"><li>Open source (MIT)</li><li>Sign in with Google</li><li>No Play Store needed</li></ul>
    </div>
    <div class="hero-art" aria-hidden="false">
      <div class="orb"></div>
      ${phoneHome}
      <p class="sample">Sample data</p>
    </div>
  </section>

  <section class="section" id="features">
    <p class="kicker">Everything in one place</p>
    <h2 class="h2">Everything your portal shows, without the portal</h2>
    <p class="sub">Open Rilvona and your whole academic day is already there.</p>
    <div class="features">
${features
  .map(
    ([t, d, c]) =>
      `      <article style="--c:${c}"><span class="dot"></span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`,
  )
  .join('\n')}
    </div>
  </section>

  <section class="section split">
    <div class="split-art">${phonePlan}<p class="sample">Sample data</p></div>
    <div class="split-copy">
      <p class="kicker">Plan before you skip</p>
      <h2 class="h2">Skip smart, not blind</h2>
      <p class="sub left">Choose how far ahead to look, decide how many classes you plan to miss, and Rilvona shows where every subject and your overall percentage will land, and what to attend to stay above the limit.</p>
      <ul class="ticks">
        <li>Per-subject “can still skip” counts</li>
        <li>Prediction to any date in the semester</li>
        <li>Spread skips across subjects automatically</li>
      </ul>
    </div>
  </section>

  <section class="section" id="how">
    <p class="kicker">How it works</p>
    <h2 class="h2">Up and running in a minute</h2>
    <ol class="steps">
${steps
  .map(([t, d], i) => `      <li><span class="num">${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`)
  .join('\n')}
    </ol>
  </section>

  <section class="section install" id="install">
    <div class="install-card">
      <div class="install-head">
        <img src="/logo.png" width="96" height="96" alt="Rilvona logo" class="logo">
        <div>
          <h2 class="h2 left">Get Rilvona for Android</h2>
          <p class="sub left">${release ? `Version ${esc(release.version)} · ${mb(release.sizeBytes)} · updated ${esc(release.date)}` : 'Latest release'}</p>
        </div>
        ${downloadButton('install')}
      </div>
      <div class="install-cols">
        <div>
          <h3>How to install</h3>
          <ol class="how">
            <li>Tap <b>Download APK</b> on your Android phone.</li>
            <li>Open the downloaded file. If Android asks, tap <b>Settings</b> and allow installs from your browser.</li>
            <li>Go back and tap <b>Install</b>, then <b>Open</b>.</li>
          </ol>
          <p class="fine">Google Play Protect may show a “not commonly downloaded” notice for apps outside the Play Store. Choose <b>More details → Install anyway</b> if you downloaded the file from this page.</p>
        </div>
        <div>
          <h3>Verify the download</h3>
          <p class="fine">Optional, for the careful. The SHA-256 of the file should be:</p>
          ${release ? `<code class="hash" id="sha">${esc(release.sha256)}</code><button class="copy" type="button" data-copy="sha">Copy checksum</button>` : '<p class="fine">Checksum available with the next release.</p>'}
          <p class="fine">On a computer: <code>shasum -a 256 rilvona.apk</code></p>
        </div>
      </div>
    </div>
  </section>

  <section class="section privacy-note">
    <h2>Your password stays on your phone</h2>
    <p>You sign in to Rilvona with Google, so there is no Rilvona password. Your university password is kept in your phone’s secure keychain and is sent only to the university’s own server. The sign-in captcha is always shown to you to solve yourself. Read the <a href="/privacy">privacy policy</a> and the <a href="/terms">terms</a>.</p>
  </section>

  <section class="section" id="faq">
    <p class="kicker">Questions</p>
    <h2 class="h2">Good to know</h2>
    <div class="faq">
${faqs.map(([q, a]) => `      <details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('\n')}
    </div>
  </section>

  <section class="final">
    <h2>Stop guessing your attendance.</h2>
    <p>Free, open source, and on your phone in a minute.</p>
    <div class="cta center">${downloadButton('footer')}</div>
  </section>
</main>
<footer>
  <nav><a href="/">Home</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms and conditions</a><a href="${REPO}">GitHub</a></nav>
  <p>Rilvona is an independent app for students. It is not owned, run, sponsored or endorsed by Chandigarh University.</p>
</footer>
<script src="/app.js" defer></script>
</body>
</html>
`;

const footer = `<footer>
  <nav><a href="/">Home</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms and conditions</a><a href="${REPO}">GitHub</a></nav>
  <p>Rilvona is an independent app for students. It is not owned, run, sponsored or endorsed by Chandigarh University.</p>
</footer>`;

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
  <p>Questions about this ${kind === 'terms' ? 'document' : 'policy'} or about your data: open an issue on <a href="${REPO}/issues">GitHub</a>.</p>
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
await writeFile(path.join(dist, 'app.js'), APP_JS);
await writeFile(path.join(dist, 'privacy', 'index.html'), legalPage('privacy', '/privacy'));
await writeFile(path.join(dist, 'terms', 'index.html'), legalPage('terms', '/terms'));
await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /download/\nSitemap: ${ORIGIN}/sitemap.xml\n`);
await writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', '/privacy', '/terms']
    .map((u) => `  <url><loc>${ORIGIN}${u === '/' ? '' : u}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);
console.log('built', dist);
