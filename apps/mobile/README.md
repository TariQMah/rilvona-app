# Rilvona mobile

React Native CLI app for the Rilvona campus community. It talks to the Nest API at `/api/v1`.

## Run on Android

Start the API on port 3000 first. The Android emulator reaches the host machine at `10.0.2.2`.

```sh
npm install
npm start -- --port 8082
```

In another terminal, with an emulator or device connected:

```sh
npm run android -- --port 8082 --no-packager
```

Port 8081 is left alone if another Metro server is already using it. iOS builds need macOS and Xcode: `npm run ios`.

## What is on screen

Welcome, registration, login, email verification, password reset, home feed, hives, posts, anonymous questions, events, search, alerts, profile, college verification, blocks, bookmarks, and account deletion.
