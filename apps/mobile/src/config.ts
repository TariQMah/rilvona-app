// Every build, debug included, talks to the production API (and so the production database). Debug builds no longer
// use a server on this computer, so there is nothing to start or `adb reverse` before running the app.
export const API_ORIGIN = 'https://api.rilvona.com';
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

// Google sign in. The web client id is the one the API checks tokens against (the API lists it in GOOGLE_CLIENT_IDS).
// It must be an OAuth client of type "Web application"; a separate "Android" client for com.ainor.hiihive and the
// signing key's SHA-1 must exist in the same Google Cloud project. Leave empty until those exist.
export const GOOGLE_WEB_CLIENT_ID =
  '336016339844-qigplr2850rt69199hmcpmbfkmfksua0.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = '';
