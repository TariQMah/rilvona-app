import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';
import type { SessionUser } from './types';

const SERVICE = 'app.hiihive.session';

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

type SessionState = {
  hydrated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  hydrate: () => Promise<void>;
  setSession: (session: StoredSession) => Promise<void>;
  patchUser: (patch: Partial<SessionUser>) => void;
  clear: () => Promise<void>;
};

async function readStored(): Promise<StoredSession | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  if (!credentials) return null;
  const parsed = JSON.parse(credentials.password) as StoredSession;
  if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) return null;
  return parsed;
}

async function writeStored(session: StoredSession | null) {
  if (!session) {
    await Keychain.resetGenericPassword({ service: SERVICE });
    return;
  }
  await Keychain.setGenericPassword('session', JSON.stringify(session), {
    service: SERVICE,
  });
}

export const useSession = create<SessionState>((set, get) => ({
  hydrated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrate: async () => {
    try {
      const stored = await Promise.race([
        readStored(),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
      ]);
      if (stored) {
        set({
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          user: stored.user,
          hydrated: true,
        });
        return;
      }
    } catch {
      // A locked keychain should not trap the welcome screen.
    }
    set({ hydrated: true });
  },
  setSession: async session => {
    set({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    });
    await writeStored(session);
  },
  patchUser: patch => {
    const current = get();
    if (!current.user || !current.accessToken || !current.refreshToken) return;
    const user = { ...current.user, ...patch };
    set({ user });
    writeStored({
      accessToken: current.accessToken,
      refreshToken: current.refreshToken,
      user,
    }).catch(() => undefined);
  },
  clear: async () => {
    set({ accessToken: null, refreshToken: null, user: null });
    await writeStored(null).catch(() => undefined);
    // Also let Google forget the account on this phone. Loaded lazily so the session store stays light.
    import('../auth/google')
      .then(google => google.signOutOfGoogle())
      .catch(() => undefined);
  },
}));
