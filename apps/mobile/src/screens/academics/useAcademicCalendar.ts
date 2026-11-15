import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  cacheCalendar,
  fetchAcademicCalendar,
  readCachedCalendar,
  readCalendarVariant,
  saveCalendarVariant,
} from '../../cuims/calendarClient';
import {
  defaultCalendarVariant,
  type CalendarVariant,
} from '../../cuims/calendarData';
import type { ConnectedOverview } from './model';

/** The calendar for one institute: fresh from the university website, or the last saved copy when offline. */
export function useAcademicCalendar(variant: CalendarVariant) {
  return useQuery({
    queryKey: ['academic-calendar', variant],
    queryFn: async () => {
      try {
        const calendar = await fetchAcademicCalendar(variant);
        void cacheCalendar(calendar);
        return calendar;
      } catch (err) {
        const cached = await readCachedCalendar(variant);
        if (cached) return cached;
        throw err;
      }
    },
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Which calendar applies to this student: the one they picked before, otherwise a guess from their programme
 * (BCA / MCA follow the Institute of Computing calendar).
 */
export function useCalendarVariant(
  connection: ConnectedOverview['connection'],
) {
  const guess = defaultCalendarVariant({
    program: connection.program,
    studentUid: connection.studentUid,
    section: connection.section,
  });
  const [variant, setVariant] = useState<CalendarVariant>(guess);
  useEffect(() => {
    let active = true;
    void readCalendarVariant().then(saved => {
      if (active && saved) setVariant(saved);
    });
    return () => {
      active = false;
    };
  }, []);
  const choose = useCallback((next: CalendarVariant) => {
    setVariant(next);
    void saveCalendarVariant(next);
  }, []);
  return [variant, choose] as const;
}
