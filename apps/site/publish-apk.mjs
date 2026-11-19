// Records a release APK in release.json (version, size, SHA-256) so the landing page can show them.
// Usage: node publish-apk.mjs path/to/app-release.apk
// Then run deploy.sh with DEPLOY_HOST set: it uploads the APK to /download/ on the server and publishes the site.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apk = process.argv[2];
if (!apk) {
  console.error('Usage: node publish-apk.mjs path/to/app-release.apk');
  process.exit(1);
}

const gradle = await readFile(path.join(here, '../mobile/android/app/build.gradle'), 'utf8');
const version = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
const minSdk = Number(/minSdkVersion\s*=\s*(\d+)/.exec(await readFile(path.join(here, '../mobile/android/build.gradle'), 'utf8'))?.[1]);
if (!version || !versionCode || !minSdk) throw new Error('Could not read version or minSdk from the Android project');

const bytes = await readFile(apk);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const sizeBytes = (await stat(apk)).size;
// Android API level -> marketing version, for the levels this app can target.
const androidFor = { 23: '6.0', 24: '7.0', 26: '8.0', 28: '9', 29: '10', 30: '11', 31: '12', 33: '13', 34: '14' };
const minAndroid = androidFor[minSdk] ?? String(minSdk);
const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Staging folder (gitignored) that deploy.sh uploads from: a stable name and a versioned copy.
const staging = path.join(here, 'apk');
await mkdir(staging, { recursive: true });
await copyFile(apk, path.join(staging, 'rilvona.apk'));
await copyFile(apk, path.join(staging, `rilvona-${version}.apk`));

await writeFile(
  path.join(here, 'release.json'),
  `${JSON.stringify({ version, versionCode, sizeBytes, sha256, minAndroid, date }, null, 2)}\n`,
);
console.log(`Recorded v${version} (${versionCode}), ${(sizeBytes / 1048576).toFixed(1)} MB, sha256 ${sha256}`);
