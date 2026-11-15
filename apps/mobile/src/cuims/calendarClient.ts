import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CALENDAR_PAGES,
  parseCalendarEvents,
  parseHolidays,
  type AcademicCalendar,
  type CalendarVariant,
} from './calendarData';

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

/** Only the university's public academics pages are ever requested here; no login, no cookies of ours. */
const isPublicAcademicsPage = (url: string) =>
  /^https:\/\/www\.cuchd\.in\/academics\/[a-z0-9-]+\.php$/i.test(url);

async function getPage(url: string, timeoutMs = 20000): Promise<string> {
  if (!isPublicAcademicsPage(url))
    throw new Error('Refusing to contact an unexpected address');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads the holiday list and the calendar that applies to the student's institute and parses both.
 * One page failing is tolerated; both failing is an error.
 */
export async function fetchAcademicCalendar(
  variant: CalendarVariant,
  now: Date = new Date(),
): Promise<AcademicCalendar> {
  const [holidays, ...calendars] = await Promise.allSettled([
    getPage(CALENDAR_PAGES.holidays),
    ...CALENDAR_PAGES[variant].map(url => getPage(url)),
  ]);
  const holidayList =
    holidays.status === 'fulfilled' ? parseHolidays(holidays.value, now) : [];
  const events = calendars
    .flatMap(result =>
      result.status === 'fulfilled' ? parseCalendarEvents(result.value) : [],
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    );
  if (holidayList.length === 0 && events.length === 0)
    throw new Error(
      'Could not read the academic calendar from the university website.',
    );
  return {
    variant,
    holidays: holidayList,
    events,
    fetchedAt: new Date().toISOString(),
  };
}

const CACHE_KEY = (variant: CalendarVariant) =>
  `hiihive:calendar:v1:${variant}`;
const VARIANT_KEY = 'hiihive:calendar-variant:v1';

export async function readCachedCalendar(
  variant: CalendarVariant,
): Promise<AcademicCalendar | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY(variant));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AcademicCalendar;
    return Array.isArray(parsed.holidays) && Array.isArray(parsed.events)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function cacheCalendar(calendar: AcademicCalendar): Promise<void> {
  await AsyncStorage.setItem(
    CACHE_KEY(calendar.variant),
    JSON.stringify(calendar),
  ).catch(() => undefined);
}

export async function readCalendarVariant(): Promise<CalendarVariant | null> {
  try {
    const value = await AsyncStorage.getItem(VARIANT_KEY);
    return value === 'UIC' || value === 'GENERAL' ? value : null;
  } catch {
    return null;
  }
}

export async function saveCalendarVariant(
  variant: CalendarVariant,
): Promise<void> {
  await AsyncStorage.setItem(VARIANT_KEY, variant).catch(() => undefined);
}
