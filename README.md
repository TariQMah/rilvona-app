# Rilvona

Rilvona (codename HiiHive) is a campus community platform: hives, posts, anonymous questions, events, search, alerts, and college verification. This repository holds the API, the mobile app, the AI helper service, and the marketing site.

Licensed under the [MIT License](LICENSE).

## Layout

| Path | What it is |
| --- | --- |
| `apps/api` | NestJS + Prisma API (PostgreSQL, Redis) served at `/api/v1` |
| `apps/mobile` | React Native app (Android and iOS) |
| `apps/ai` | Small FastAPI service the API calls for AI features (Mistral) |
| `apps/site` | Static marketing site (`node build.mjs`) |
| `packages/contracts` | Shared types and schemas used by the API |

## Requirements

- Node.js 24 (see `.nvmrc`; `>=22.11` works)
- PostgreSQL and Redis
- Python 3.11+ for `apps/ai` (optional)
- Android Studio and/or Xcode for the mobile app

## Run the API

```sh
npm install
cp apps/api/.env.example apps/api/.env   # then set the secrets
npm run prisma:migrate
npm run seed                             # optional, needs SEED_ADMIN_* in .env
npm run dev:api
```

Run the tests with `npm test`. Production settings are listed in `apps/api/.env.production.example`.

## Run the AI service (optional)

```sh
cd apps/ai
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                     # set AI_SERVICE_KEY and MISTRAL_API_KEY
./run.sh
```

## Run the mobile app

```sh
npm run mobile:install
npm run mobile:start
npm run mobile:android      # or mobile:ios
```

The app talks to the hosted API by default. Before developing against your own API, change `API_ORIGIN` in `apps/mobile/src/config.ts` and set your own Google sign-in client IDs there. Be careful not to run a debug build against production data you don't want to change.

To sign a release build, create `~/hiihive-signing/keystore.properties` (or point `HIIHIVE_KEYSTORE_PROPERTIES` at another file) with `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`. It lives outside the repo, and all keystores are gitignored. Without it, release builds fall back to the debug key.

## Website and APK downloads

`apps/site` is the landing page at rilvona.com. The Android app is distributed as a self-hosted APK instead of through the Play Store.

```sh
# 1. Build a signed APK (arm64 and armv7 keep it small)
cd apps/mobile/android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a

# 2. Record its version, size and SHA-256 in apps/site/release.json and stage it for upload
cd ../../site && node publish-apk.mjs ../mobile/android/app/build/outputs/apk/release/app-release.apk

# 3. Upload the APK to /download/ and publish the site
DEPLOY_HOST=user@your-server ./deploy.sh
```

The download button links to the versioned file (`/download/rilvona-<version>.apk`); `/download/rilvona.apk` always points to the latest. The server needs a `/download/` location that serves `.apk` as `application/vnd.android.package-archive`. Commit the updated `release.json` after each release. Keep the signing key safe: updates only install over an existing app when signed with the same key.

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run mobile:test` before opening a PR. Never commit `.env` files, keystores, or OAuth client secrets.

## Third-party

The Inter typeface is bundled under the SIL Open Font License; see `apps/mobile/licenses/Inter-OFL.txt`.
