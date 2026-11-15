import { QueryClient } from '@tanstack/react-query';
import {
  clearQueryCache,
  restoreQueryCache,
  subscribeQueryCache,
} from '../src/api/queryCache';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      getAllKeys: jest.fn(async () => [...store.keys()]),
      multiRemove: jest.fn(async (keys: string[]) => {
        keys.forEach(key => store.delete(key));
      }),
    },
  };
});

const dashboard = { connected: true, attendance: [{ courseCode: 'A' }] };

beforeEach(async () => {
  await clearQueryCache();
});

test('restores the dashboard after a fresh start', async () => {
  const first = new QueryClient();
  const stop = subscribeQueryCache(first, 'user-1');
  first.setQueryData(['academics'], {
    ...dashboard,
    attendance: [{ courseCode: 'B' }],
  });
  await new Promise<void>(resolve => setTimeout(resolve, 300));
  stop();

  const second = new QueryClient();
  const count = await restoreQueryCache(second, 'user-1');
  expect(count).toBe(1);
  expect(second.getQueryData(['academics'])).toEqual({
    connected: true,
    attendance: [{ courseCode: 'B' }],
  });
});

test('does not restore another account’s dashboard', async () => {
  const client = new QueryClient();
  const stop = subscribeQueryCache(client, 'user-1');
  client.setQueryData(['academics'], dashboard);
  await new Promise<void>(resolve => setTimeout(resolve, 300));
  stop();

  const other = new QueryClient();
  expect(await restoreQueryCache(other, 'user-2')).toBe(0);
  expect(other.getQueryData(['academics'])).toBeUndefined();
});

test('does not persist feed or other live lists', async () => {
  const client = new QueryClient();
  const stop = subscribeQueryCache(client, 'user-1');
  client.setQueryData(['feed'], [{ id: 1 }]);
  await new Promise<void>(resolve => setTimeout(resolve, 300));
  stop();

  const next = new QueryClient();
  await restoreQueryCache(next, 'user-1');
  expect(next.getQueryData(['feed'])).toBeUndefined();
});

test('clearQueryCache drops only the saved snapshot', async () => {
  const client = new QueryClient();
  const stop = subscribeQueryCache(client, 'user-1');
  client.setQueryData(['academics'], dashboard);
  await new Promise<void>(resolve => setTimeout(resolve, 300));
  stop();
  await clearQueryCache('user-1');
  const next = new QueryClient();
  expect(await restoreQueryCache(next, 'user-1')).toBe(0);
});
