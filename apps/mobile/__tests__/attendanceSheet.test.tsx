import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { AttendanceCourse } from '../src/api/types';
import { AttendanceSheet } from '../src/screens/academics/AttendanceSheet';

const course: AttendanceCourse = {
  id: 'c1',
  courseCode: 'TEST-1',
  courseName: 'Test Subject',
  facultyName: 'Dr Test',
  attendedClasses: 8,
  deliveredClasses: 10,
  dutyLeave: 0,
  percentage: 80,
  minRequired: 75,
  lastLectureAt: null,
  lastStatus: null,
  guidance: { status: 'SAFE', canMiss: 1, needToAttend: 0, label: 'Safe' },
  history: [
    { date: '2026-10-01', timing: '09:00 - 09:50', status: 'PRESENT' },
    { date: '2026-10-02', timing: '09:00 - 09:50', status: 'ABSENT' },
    { date: '2026-10-05', timing: '09:00 - 09:50', status: 'PRESENT' },
    { date: '2026-09-28', timing: '09:00 - 09:50', status: 'DUTY_LEAVE' },
  ],
};

const openTab = async (
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
) => {
  const tab = tree.root
    .findAll(
      node =>
        node.props.accessibilityRole === 'tab' &&
        typeof node.props.onPress === 'function',
    )
    .find(node =>
      node
        .findAll(n => (n.type as unknown) === 'Text')
        .some(n => n.children.join('') === label),
    );
  await ReactTestRenderer.act(async () => tab?.props.onPress());
};

const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => node.children.join(''));

describe('AttendanceSheet', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders prediction and grouped history', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <AttendanceSheet course={course} visible onClose={() => undefined} />,
      );
    });
    const overview = texts(tree).join(' | ');
    expect(overview).toContain('Test Subject');
    expect(overview).toContain('No spare classes');
    expect(overview).not.toContain('Attendance history');
    await openTab(tree, 'History');
    const all = texts(tree).join(' | ');
    expect(all).toContain('Current streak');
    expect(all).toContain('October 2026');
    expect(all).toContain('September 2026');
    expect(all).toContain('Absent');
    expect(all).toContain('Duty leave');
    expect(all).not.toContain('not loaded yet');
    await ReactTestRenderer.act(async () => tree.unmount());
  });

  it('explains missing history instead of showing an empty list', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <AttendanceSheet
          course={{ ...course, history: [] }}
          visible
          onClose={() => undefined}
        />,
      );
    });
    await openTab(tree, 'History');
    expect(texts(tree).join(' | ')).toContain('not loaded yet');
    await ReactTestRenderer.act(async () => tree.unmount());
  });
});
