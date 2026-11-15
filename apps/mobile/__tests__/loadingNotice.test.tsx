import { act, create } from 'react-test-renderer';
import {
  LoadingNotice,
  loadingMessage,
} from '../src/screens/academics/ui/LoadingNotice';

const textOf = (node: unknown): string => {
  const n = node as { children?: unknown[] } | string | null;
  if (n == null) return '';
  if (typeof n === 'string') return n;
  return (n.children ?? []).map(textOf).join(' ');
};

test('the message gets more reassuring the longer the wait', () => {
  expect(loadingMessage(0).title).toBe('Loading your dashboard');
  expect(loadingMessage(5).title).toBe('Still working…');
  expect(loadingMessage(12).title).toBe('Taking longer than usual');
  expect(loadingMessage(12).hint).toContain('internet connection');
});

test('the notice updates on its own while waiting', () => {
  jest.useFakeTimers();
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<LoadingNotice />);
  });
  expect(textOf(tree.toJSON())).toContain('Loading your dashboard');
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(textOf(tree.toJSON())).toContain('Still working');
  act(() => {
    jest.advanceTimersByTime(7000);
  });
  expect(textOf(tree.toJSON())).toContain('Taking longer than usual');
  act(() => tree.unmount());
  jest.useRealTimers();
});
