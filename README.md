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

To sign a release build, create `apps/mobile/android/keystore.properties` with `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`. That file and all keystores are gitignored.

## Deploy the site

```sh
DEPLOY_HOST=user@your-server apps/site/deploy.sh
```

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run mobile:test` before opening a PR. Never commit `.env` files, keystores, or OAuth client secrets.

## Third-party

The Inter typeface is bundled under the SIL Open Font License; see `apps/mobile/licenses/Inter-OFL.txt`.
