import { loadDatesheet } from '../src/cuims/datesheetClient';

const mockFetchDatesheetPages = jest.fn();

jest.mock('../src/cuims/client', () => ({
  fetchDatesheetPages: (...args: unknown[]) => mockFetchDatesheetPages(...args),
}));

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

beforeEach(() => {
  mockFetchDatesheetPages.mockReset();
});

test('an unpublished date sheet is an empty list, not an error', async () => {
  mockFetchDatesheetPages.mockResolvedValue([
    {
      kind: 'theory',
      status: 200,
      html: '<title>UIMS Error</title><h1>Whoops, Something broke!</h1>',
      failed: true,
    },
    { kind: 'practical', status: 200, html: '', failed: true },
  ]);
  const result = await loadDatesheet();
  expect(result.expired).toBe(false);
  expect(result.fromCache).toBe(false);
  expect(result.data?.entries).toEqual([]);
});
