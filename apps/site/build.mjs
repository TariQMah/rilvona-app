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
const REPO = 'https://github.com/myainor/rilvona-app';
const APK_STABLE_URL = '/download/rilvona.apk';
const GOOD_FIRST = `${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22`;
const OPEN_BUGS = `${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3Abug`;

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
const appJs = await readFile(path.join(here, 'app.js'), 'utf8');
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

const head = ({ title, description, path: p, extra = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#000000">
<link rel="canonical" href="${ORIGIN}${p}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/inter-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/inter-semibold.woff2" as="font" type="font/woff2" crossorigin>
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${ORIGIN}/icon-512.png">
<meta property="og:url" content="${ORIGIN}${p}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
${extra}<style>${css}</style>
</head>`;

const svg = (body, size = 22, extra = '') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

const icon = {
  download: svg('<path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/>', 20),
  arrow: svg('<path d="M5 12h14m-6-6 6 6-6 6"/>', 18),
  github:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
  android:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.5 8.6 19 6a.5.5 0 1 0-.87-.5l-1.52 2.65A9.3 9.3 0 0 0 12 7.2c-1.7 0-3.3.4-4.6 1l-1.5-2.7A.5.5 0 0 0 5 6l1.5 2.6A7.7 7.7 0 0 0 3 15h18a7.7 7.7 0 0 0-3.5-6.4ZM8.5 12.6a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Zm7 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8ZM3 16.2v.6a1.4 1.4 0 0 0 1.4 1.4h.7v2.4a1.2 1.2 0 0 0 2.4 0v-2.4h1.3v2.4a1.2 1.2 0 0 0 2.4 0v-2.4h1.6v2.4a1.2 1.2 0 0 0 2.4 0v-2.4h1.3v2.4a1.2 1.2 0 0 0 2.4 0v-2.4h.7A1.4 1.4 0 0 0 21 16.8v-.6H3Z"/></svg>',
  attendance: svg('<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>'),
  planner: svg('<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  timetable: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  marks: svg('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  datesheet: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  calendar: svg('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
  ai: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>'),
  idcard: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.5 1.7-2 3-2s2.4.5 3 2M14 10h4M14 14h4"/>'),
  community: svg('<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3 2.5 3.3 5.2"/>'),
  bug: svg('<rect x="8" y="8" width="8" height="12" rx="4"/><path d="M12 8V5M9 5l1.5 1.5M15 5l-1.5 1.5M4 12h4M16 12h4M5 19l3-2M19 19l-3-2M5 6l3 2M19 6l-3 2"/>'),
  feature: svg('<path d="M12 4v16M4 12h16"/>'),
  docs: svg('<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 8h6"/>'),
};

const downloadButton = (where) => `<a class="btn primary" href="${APK_URL}" download data-track="${where}">${icon.download}<span><b>Download APK</b>${
  release ? `<small>v${esc(release.version)} · ${mb(release.sizeBytes)} · Android ${esc(release.minAndroid)}+</small>` : ''
}</span></a>`;

const features = [
  [icon.attendance, 'Live attendance', 'Your real numbers from the university portal, subject by subject, with how many classes you can still skip.'],
  [icon.planner, 'Class planner', 'Slide to a date and see where your overall percentage ends up, and exactly which classes to attend to stay safe.'],
  [icon.timetable, 'Timetable', 'Today’s classes with time, room and teacher, plus a live “class now” card.'],
  [icon.marks, 'Marks and results', 'Internal marks, averages and results in one clean view.'],
  [icon.datesheet, 'Date sheet', 'Exam dates, timings and venues, with a countdown to your next paper.'],
  [icon.calendar, 'Academic calendar', 'Holidays, breaks and teaching days, so you can plan the whole semester.'],
  [icon.ai, 'AI study assistant', 'Ask “Which subjects are at risk?” or “Can I skip tomorrow?” and get an answer from your own data.'],
  [icon.idcard, 'Virtual ID card', 'Your university ID card on your phone, saved for when you need it.'],
  [icon.community, 'Campus community', 'Hives, posts, events and anonymous questions with students from your college.'],
];

const steps = [
  ['Install', 'Download the APK and open it. Android will ask you to allow installs from your browser once.'],
  ['Sign in with Google', 'No new password to remember. Rilvona never sees your Google password.'],
  ['Link your university portal', 'Add your portal login once. It stays in your phone’s secure keychain.'],
  ['You’re done', 'Attendance, timetable, marks and dates are ready, and refresh whenever you open the app.'],
];

const ways = [
  [icon.bug, 'Fix a bug', `Pick one from the <a href="${OPEN_BUGS}">open bugs</a>, such as portal pages that stop loading, and make Rilvona work for more students.`],
  [icon.feature, 'Build a feature', 'Help add campuses, improve the class planner, bring the app to iPhone, or write tests and CI. Ideas are welcome too.'],
  [icon.docs, 'Improve the docs', 'Better setup guides, clearer install steps and translations help the next student get started faster.'],
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
    'Can I contribute?',
    `Yes. We are accepting open-source contributions on <a href="${REPO}">rilvona-app</a>, from bug fixes to new features and docs. Start with the <a href="${GOOD_FIRST}">good first issues</a>.`,
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

const footer = `<footer>
  <div class="foot">
    <a href="/" class="brand"><img src="/icon-192.png" width="28" height="28" alt=""> Rilvona</a>
    <nav><a href="/">Home</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms and conditions</a><a href="${REPO}">GitHub</a></nav>
  </div>
  <p>Rilvona is an independent app for students. It is not owned, run, sponsored or endorsed by Chandigarh University.</p>
</footer>`;

const landing = `${head({
  title: 'Rilvona – attendance, timetable and marks in one app | Download for Android',
  description:
    'Rilvona shows your university attendance, timetable, marks, date sheet and academic calendar in one clean app, and tells you how many classes you can skip. Free, open source Android APK, no Play Store needed.',
  path: '/',
  extra: `<script type="application/ld+json">${JSON.stringify(appJson)}</script>\n<script type="application/ld+json">${JSON.stringify(faqJson)}</script>\n`,
})}
<body class="home">
<canvas id="stars" aria-hidden="true"></canvas>
<header class="nav">
  <a href="/" class="brand"><img src="/icon-192.png" width="30" height="30" alt=""> Rilvona</a>
  <nav>
    <a href="#features">Features</a><a href="#how">How it works</a><a href="#install">Install</a><a href="#contribute">Contribute</a><a href="#faq">FAQ</a>
  </nav>
  <a class="btn small" href="#download">Download</a>
</header>
<main>
  <section class="hero" id="download">
    <div class="hero-copy">
      <p class="pill"><span class="live"></span>Free and open source · v${release ? esc(release.version) : '1'}</p>
      <div class="appid"><img src="/icon-192.png" width="56" height="56" alt=""><div><b>Rilvona</b><span>Your university companion</span></div></div>
      <h1>University life,<br><span class="fade">made simple.</span></h1>
      <p class="lead">Attendance, timetable, marks, date sheet and the academic calendar in one clean app, with the maths done for you. Know exactly how many classes you can skip.</p>
      <div class="cta">
        ${downloadButton('hero')}
        <a class="btn dark" href="${REPO}">${icon.github}<span><b>View source</b></span></a>
      </div>
      <p class="notice" id="platform-note" hidden></p>
      <ul class="facts">
        <li>${icon.android}<span>Android ${release ? esc(release.minAndroid) : '7.0'}+</span></li>
        <li><span>MIT licensed</span></li>
        <li><span>Sign in with Google</span></li>
        <li><span>No Play Store needed</span></li>
      </ul>
    </div>
    <div class="hero-art">
      <div class="halo"></div>
      ${phoneHome}
      <p class="sample">Sample data</p>
    </div>
  </section>

  <section class="section" id="features">
    <p class="kicker">Features</p>
    <h2 class="h2">Everything your portal shows,<br><span class="fade">without the portal.</span></h2>
    <p class="sub">Open Rilvona and your whole academic day is already there.</p>
    <div class="features">
${features
  .map(
    ([ico, t, d]) =>
      `      <article class="spot"><span class="ico">${ico}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`,
  )
  .join('\n')}
    </div>
  </section>

  <section class="section split">
    <div class="split-art">${phonePlan}<p class="sample">Sample data</p></div>
    <div class="split-copy">
      <p class="kicker">Plan before you skip</p>
      <h2 class="h2">Skip smart,<br><span class="fade">not blind.</span></h2>
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
    <h2 class="h2">Up and running <span class="fade">in a minute.</span></h2>
    <ol class="steps">
${steps
  .map(([t, d], i) => `      <li class="spot"><span class="num">0${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`)
  .join('\n')}
    </ol>
  </section>

  <section class="section install" id="install">
    <div class="install-card">
      <div class="install-head">
        <img src="/icon-512.png" width="84" height="84" alt="Rilvona app icon" class="appicon">
        <div>
          <h2 class="h3">Get Rilvona for Android</h2>
          <p class="meta">${release ? `Version ${esc(release.version)} · ${mb(release.sizeBytes)} · updated ${esc(release.date)}` : 'Latest release'}</p>
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
    <span class="ico">${svg('<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>')}</span>
    <div>
      <h2>Your password stays on your phone</h2>
      <p>You sign in to Rilvona with Google, so there is no Rilvona password. Your university password is kept in your phone’s secure keychain and is sent only to the university’s own server. The sign-in captcha is always shown to you to solve yourself. Read the <a href="/privacy">privacy policy</a> and the <a href="/terms">terms</a>.</p>
    </div>
  </section>

  <section class="section contribute" id="contribute">
    <p class="kicker">Open source</p>
    <h2 class="h2">Built by students.<br><span class="fade">Open to your contributions.</span></h2>
    <p class="sub">Rilvona is open source under the MIT license, and we are actively accepting contributions on <a href="${REPO}">rilvona-app</a>. If you have ever fought with a university portal, you can help make life easier for college students everywhere.</p>
    <div class="features three">
${ways
  .map(([ico, t, d]) => `      <article class="spot"><span class="ico">${ico}</span><h3>${esc(t)}</h3><p>${d}</p></article>`)
  .join('\n')}
    </div>
    <div class="cta center">
      <a class="btn primary" href="${REPO}">${icon.github}<span><b>Contribute on GitHub</b><small>Fork, fix, open a pull request</small></span></a>
      <a class="btn dark" href="${GOOD_FIRST}"><span><b>Good first issues</b><small>Easy places to start</small></span>${icon.arrow}</a>
    </div>
  </section>

  <section class="section" id="faq">
    <p class="kicker">Questions</p>
    <h2 class="h2">Good to know</h2>
    <div class="faq">
${faqs.map(([q, a]) => `      <details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('\n')}
    </div>
  </section>

  <section class="final">
    <h2>Stop guessing your <span class="fade">attendance.</span></h2>
    <p>Free, open source, and on your phone in a minute.</p>
    <div class="cta center">${downloadButton('footer')}</div>
  </section>
</main>
${footer}
<script src="/app.js" defer></script>
</body>
</html>
`;

const legalPage = (kind, p) => {
  const doc = LEGAL[kind];
  return `${head({ title: `${doc.title} – Rilvona`, description: doc.intro, path: p })}
<body class="doc">
<canvas id="stars" aria-hidden="true"></canvas>
<header class="nav"><a href="/" class="brand"><img src="/icon-192.png" width="30" height="30" alt=""> Rilvona</a><a class="btn small" href="/#download">Download</a></header>
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
<script src="/app.js" defer></script>
</body>
</html>
`;
};

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'privacy'), { recursive: true });
await mkdir(path.join(dist, 'terms'), { recursive: true });
await cp(path.join(here, 'public'), dist, { recursive: true });
await writeFile(path.join(dist, 'index.html'), landing);
await writeFile(path.join(dist, 'app.js'), appJs);
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
