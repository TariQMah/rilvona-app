import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDatesheetPages } from './client';
import { parseDatesheet, type Datesheet } from './datesheetData';

const CACHE_KEY = 'hiihive:datesheet:v1';

export type DatesheetResult = {
  data: Datesheet | null;
  /** The numbers come from the copy saved on this phone, not from the portal just now. */
  fromCache: boolean;
  /** The saved portal session has expired, so a fresh login is needed to update. */
  expired: boolean;
};

export async function readCachedDatesheet(): Promise<Datesheet | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Datesheet;
    return Array.isArray(parsed.entries) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearCachedDatesheet(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
}

/**
 * The student's date sheet: read from the portal with the saved session, kept on the phone only, and shown from
 * that copy when the session has expired or the portal cannot be reached.
 */
export async function loadDatesheet(): Promise<DatesheetResult> {
  let pages: Awaited<ReturnType<typeof fetchDatesheetPages>> = null;
  let reachable = true;
  try {
    pages = await fetchDatesheetPages();
  } catch {
    reachable = false;
  }
  const cached = await readCachedDatesheet();
  if (!pages) {
    return { data: cached, fromCache: true, expired: reachable };
  }
  const theory = pages.find(p => p.kind === 'theory');
  const practical = pages.find(p => p.kind === 'practical');
  // A live session that still gets the portal error page means CUIMS has not
  // published a date sheet (the official menu link also opens error.html).
  if (!theory || theory.failed) {
    if (cached) return { data: cached, fromCache: true, expired: false };
    const empty: Datesheet = {
      entries: [],
      practicalChecked: !!practical && !practical.failed,
      fetchedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(empty)).catch(
      () => undefined,
    );
    return { data: empty, fromCache: false, expired: false };
  }
  const data: Datesheet = {
    entries: [
      ...parseDatesheet(theory.html, 'theory'),
      ...(practical && !practical.failed
        ? parseDatesheet(practical.html, 'practical')
        : []),
    ],
    practicalChecked: !!practical && !practical.failed,
    fetchedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(
    () => undefined,
  );
  return { data, fromCache: false, expired: false };
}
