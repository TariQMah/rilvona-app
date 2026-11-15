import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Chandigarh University runs the same student portal (UIMS) for each campus, each on its own address. The app talks
 * to one at a time: the campus the student picked when they connected.
 */
export type CampusId = 'chandigarh' | 'lucknow';

export type Campus = {
  id: CampusId;
  name: string;
  place: string;
  /** The student portal, with a trailing slash. */
  base: string;
  /** The portal's mentor lookup host (plain http, like the portal's own dashboard uses). */
  apiHost: string;
};

export const CAMPUSES: Campus[] = [
  {
    id: 'chandigarh',
    name: 'Chandigarh',
    place: 'Gharuan, Punjab',
    base: 'https://students.cuchd.in/',
    apiHost: 'uimsapi.cuchd.in',
  },
  {
    id: 'lucknow',
    name: 'Lucknow',
    place: 'Unnao, Uttar Pradesh',
    base: 'https://student.culko.in/',
    apiHost: 'uimsapi.culko.in',
  },
];

const KEY = 'rilvona_cuims_campus_v1';

let active: Campus = CAMPUSES[0] as Campus;

export const campusById = (id: string | null | undefined): Campus =>
  CAMPUSES.find(c => c.id === id) ?? (CAMPUSES[0] as Campus);

export const getCampus = (): Campus => active;

/** Address of the portal for the active campus, e.g. `https://students.cuchd.in/`. */
export const campusBase = (): string => active.base;

/** Whether `url` is a portal or university address the app is allowed to talk to. */
export const isUniversityHost = (url: string): boolean =>
  /^https:\/\/([a-z0-9-]+\.)*(cuchd|culko)\.in(\/|$)/i.test(url) ||
  // the portal's own dashboard script reads the mentor card from this host over plain http
  /^http:\/\/uimsapi\.(cuchd|culko)\.in\//i.test(url);

/** Which campus a portal address belongs to, if it is one of ours. */
export const campusOfUrl = (url: string): Campus | null =>
  CAMPUSES.find(c => url.startsWith(c.base.replace(/\/$/, ''))) ?? null;

export async function setCampus(id: CampusId): Promise<void> {
  active = campusById(id);
  await AsyncStorage.setItem(KEY, active.id).catch(() => undefined);
}

/** Read the saved campus once at start-up, before any portal request is made. */
export async function loadCampus(): Promise<Campus> {
  try {
    active = campusById(await AsyncStorage.getItem(KEY));
  } catch {
    active = CAMPUSES[0] as Campus;
  }
  return active;
}
