import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { checkPortalSession } from '../../cuims/client';

/** Do not ask the portal again sooner than this when the app is merely brought back to the front. */
const RECHECK_AFTER_MS = 10 * 60 * 1000;

/**
 * Tells the dashboard whether the saved university session has lapsed, so it can ask for the captcha instead of
 * quietly showing old numbers. Checks when it is switched on, when the app returns to the front after a while, and
 * every time `paused` goes back to false (the sign in sheet was just closed).
 */
export function usePortalSession(enabled: boolean, paused: boolean) {
  const [expired, setExpired] = useState(false);
  const lastCheck = useRef(0);
  const running = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const check = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const state = await checkPortalSession();
      lastCheck.current = Date.now();
      // A portal that cannot be reached says nothing about the session, so keep whatever was known.
      if (alive.current && state !== 'unreachable') {
        setExpired(state === 'expired');
      }
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (enabled && !paused) void check();
  }, [enabled, paused, check]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', next => {
      if (
        next === 'active' &&
        Date.now() - lastCheck.current > RECHECK_AFTER_MS
      ) {
        void check();
      }
    });
    return () => subscription.remove();
  }, [enabled, check]);

  return { expired: enabled && expired, recheck: check };
}
