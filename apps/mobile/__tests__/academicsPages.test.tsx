import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { AttendanceCourse, TimetableSlotItem } from '../src/api/types';
import { CalendarPage } from '../src/screens/academics/CalendarPage';
import { LegalSheet } from '../src/screens/academics/LegalSheet';
import { PredictionPage } from '../src/screens/academics/PredictionPage';
import type { ConnectedOverview } from '../src/screens/academics/model';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../src/cuims/calendarClient', () => {
  const calendar = {
    variant: 'UIC',
    fetchedAt: '2026-10-20T04:00:00.000Z',
    holidays: [
      { date: '2026-10-26', name: 'Maharishi Valmiki Jayanti' },
      { date: '2026-11-08', name: 'Diwali' },
    ],
    events: [
      {
        date: '2026-11-09',
        endDate: '2026-11-11',
        title: 'Diwali Break',
        kind: 'break',
      },
      { date: '2026-11-13', title: 'Last Teaching Day', kind: 'teaching-end' },
    ],
  };
  return {
    fetchAcademicCalendar: jest.fn(async () => calendar),
    cacheCalendar: jest.fn(async () => undefined),
    readCachedCalendar: jest.fn(async () => null),
    readCalendarVariant: jest.fn(async () => null),
    saveCalendarVariant: jest.fn(async () => undefined),
  };
});

const slot = (
  dayOfWeek: number,
  startTime: string,
  courseCode: string,
): TimetableSlotItem =>
  ({
    id: `${dayOfWeek}-${startTime}`,
    dayOfWeek,
    startTime,
    endTime: '10:45',
    courseCode,
    courseName: `Course ${courseCode}`,
    room: 'R1',
    facultyName: 'Dr X',
    slotType: 'LECTURE',
  } as TimetableSlotItem);

const course = (code: string, attended: number, delivered: number) =>
  ({
    id: code,
    courseCode: code,
    courseName: `Course ${code}`,
    attendedClasses: attended,
    deliveredClasses: delivered,
    percentage: (attended / delivered) * 100,
    minRequired: 75,
  } as AttendanceCourse);

const data = {
  connected: true,
  connection: {
    studentUid: '26MCI10238',
    studentName: 'Test Student',
    program: 'Chandigarh University (MCI)',
    semester: 1,
    section: '26MAM-4',
    isDemo: false,
    photo: null,
  },
  attendance: [course('A', 8, 10), course('B', 9, 10)],
  timetable: [
    slot(1, '09:55', 'A'),
    slot(2, '09:55', 'B'),
    slot(3, '09:55', 'A'),
    slot(4, '09:55', 'B'),
    slot(5, '09:55', 'A'),
  ],
} as unknown as ConnectedOverview;

const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => node.children.join(''))
    .join(' | ');

async function render(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });
  // Let the mocked calendar request resolve and the page re-render with it.
  for (let i = 0; i < 5; i += 1)
    await ReactTestRenderer.act(async () => {
      await new Promise<void>(resolve => setImmediate(resolve));
    });
  return tree;
}

describe('academics pages', () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(new Date(2026, 9, 20, 10, 0));
  });
  afterEach(() => jest.useRealTimers());

  it('predicts overall attendance up to the last teaching day', async () => {
    const tree = await render(
      <PredictionPage
        data={data}
        onClose={() => undefined}
        onOpenCalendar={() => undefined}
      />,
    );
    const all = texts(tree);
    expect(all).toContain('Attendance prediction');
    expect(all).toContain('Until 13 Nov 2026');
    expect(all).toContain('PREDICTED');
    expect(all).toContain('NOW 85%');
    // 26 Oct and 8-11 Nov are holidays that fall on class days.
    expect(all).toContain('Skipping');
    expect(all).toContain('BY SUBJECT');
    expect(all).toContain('Course A');
    await ReactTestRenderer.act(async () => tree.unmount());
  });

  it('shows the holiday calendar with the next holiday', async () => {
    const tree = await render(
      <CalendarPage data={data} onClose={() => undefined} />,
    );
    const all = texts(tree);
    expect(all).toContain('Academic calendar');
    expect(all).toContain('NEXT HOLIDAY');
    expect(all).toContain('Maharishi Valmiki Jayanti');
    expect(all).toContain('October 2026');
    expect(all).toContain('cuchd.in');
    await ReactTestRenderer.act(async () => tree.unmount());
  });

  it('shows the terms and the privacy policy', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <LegalSheet kind="privacy" onClose={() => undefined} />,
      );
    });
    expect(texts(tree)).toContain('Privacy policy');
    expect(texts(tree)).toContain('keychain');
    await ReactTestRenderer.act(async () =>
      tree.update(<LegalSheet kind="terms" onClose={() => undefined} />),
    );
    expect(texts(tree)).toContain('Terms and conditions');
    await ReactTestRenderer.act(async () => tree.unmount());
  });
});
