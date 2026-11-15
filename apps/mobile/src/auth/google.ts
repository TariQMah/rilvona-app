import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config';

/** Thrown with a sentence a student can act on. */
export class GoogleSignInError extends Error {}

let configured = false;

export const googleSignInConfigured = () => GOOGLE_WEB_CLIENT_ID.length > 0;

function configure() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: ['email', 'profile'],
  });
  configured = true;
}

/** Opens Google's account chooser and returns the signed ID token, or null when the student backs out. */
export async function getGoogleIdToken(): Promise<string | null> {
  if (!googleSignInConfigured()) {
    throw new GoogleSignInError(
      'Google sign in is not set up in this build yet.',
    );
  }
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Forget the previous choice so the chooser always appears (shared phones, switching accounts).
    await GoogleSignin.signOut().catch(() => undefined);
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return null;
    const token = response.data.idToken;
    if (!token)
      throw new GoogleSignInError(
        'Google did not return a sign in. Try again.',
      );
    return token;
  } catch (error) {
    if (error instanceof GoogleSignInError) throw error;
    if (__DEV__) {
      const code = isErrorWithCode(error) ? error.code : 'none';
      console.warn(`[google] sign in failed, code=${code}`, error);
    }
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInError(
          'Google Play services is missing or out of date on this phone.',
        );
      }
    }
    throw new GoogleSignInError(
      'Google sign in did not finish. Check your connection and try again.',
    );
  }
}

/** Clears Google's own remembered account on this phone. Safe to call when nobody is signed in. */
export async function signOutOfGoogle() {
  if (!googleSignInConfigured()) return;
  configure();
  await GoogleSignin.signOut().catch(() => undefined);
}
