import * as Keychain from 'react-native-keychain';
import { useSession } from '../api/session';

const SERVICE = 'app.hiihive.cuims';
const OWNER_SERVICE = 'app.hiihive.cuims.owner';

export type CuimsCredentials = { uid: string; password: string };

const currentUserId = () => useSession.getState().user?.id ?? null;

async function readOwner(): Promise<string | null> {
  try {
    const stored = await Keychain.getGenericPassword({
      service: OWNER_SERVICE,
    });
    return stored ? stored.username : null;
  } catch {
    return null;
  }
}

async function writeOwner(userId: string) {
  await Keychain.setGenericPassword(userId, 'owner', {
    service: OWNER_SERVICE,
  }).catch(() => undefined);
}

/**
 * Stored only in the device keychain. Never sent to the Rilvona server. It belongs to the Rilvona account that saved
 * it: another account signing in on this phone never sees it, and it is deleted instead.
 */
export async function loadCuimsCredentials(): Promise<CuimsCredentials | null> {
  const me = currentUserId();
  if (!me) return null;
  try {
    const stored = await Promise.race([
      Keychain.getGenericPassword({ service: SERVICE }),
      new Promise<false>(resolve => setTimeout(() => resolve(false), 4000)),
    ]);
    if (!stored) return null;
    const owner = await readOwner();
    if (owner && owner !== me) {
      await forgetCuimsCredentials();
      return null;
    }
    // A login saved before owners were recorded was saved by whoever is signed in now.
    if (!owner) await writeOwner(me);
    return { uid: stored.username, password: stored.password };
  } catch {
    return null;
  }
}

export async function saveCuimsCredentials(credentials: CuimsCredentials) {
  await Keychain.setGenericPassword(credentials.uid, credentials.password, {
    service: SERVICE,
  });
  const me = currentUserId();
  if (me) await writeOwner(me);
}

export async function forgetCuimsCredentials() {
  await Keychain.resetGenericPassword({ service: SERVICE }).catch(
    () => undefined,
  );
  await Keychain.resetGenericPassword({ service: OWNER_SERVICE }).catch(
    () => undefined,
  );
}

/** Called when someone signs in: a saved university login that belongs to a different account is deleted at once. */
export async function releaseCredentialsNotOwnedBy(userId: string) {
  const owner = await readOwner();
  if (owner && owner !== userId) await forgetCuimsCredentials();
}
