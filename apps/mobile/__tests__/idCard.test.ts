import { NativeModules } from 'react-native';
import { fetchVirtualIdCard } from '../src/cuims/client';
import {
  clearCachedIdCard,
  loadIdCard,
  readCachedIdCard,
} from '../src/cuims/idCardClient';

jest.mock('../src/cuims/client', () => ({
  fetchVirtualIdCard: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
      removeItem: jest.fn(async (k: string) => void store.delete(k)),
    },
  };
});

const fetchCard = fetchVirtualIdCard as jest.Mock;
const render = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  await clearCachedIdCard();
  render.mockResolvedValue('PNGDATA');
  (NativeModules as Record<string, unknown>).PdfRender = {
    renderFirstPage: render,
  };
});

test('downloads the card, draws it and keeps a copy on the phone', async () => {
  fetchCard.mockResolvedValue('JVBERpdf');
  const result = await loadIdCard();
  expect(render).toHaveBeenCalledWith('JVBERpdf', expect.any(Number));
  expect(result).toMatchObject({
    fromCache: false,
    expired: false,
    data: { png: 'PNGDATA' },
  });
  expect((await readCachedIdCard())?.png).toBe('PNGDATA');
});

test('an expired session shows the saved copy and says it expired', async () => {
  fetchCard.mockResolvedValueOnce('JVBERpdf');
  await loadIdCard();
  fetchCard.mockResolvedValueOnce(null);
  const result = await loadIdCard();
  expect(result).toMatchObject({
    fromCache: true,
    expired: true,
    data: { png: 'PNGDATA' },
  });
  expect(render).toHaveBeenCalledTimes(1);
});

test('an expired session with nothing saved asks for a refresh', async () => {
  fetchCard.mockResolvedValue(null);
  const result = await loadIdCard();
  expect(result).toEqual({ data: null, fromCache: true, expired: true });
});

test('a portal failure falls back to the saved copy, or reports the failure', async () => {
  fetchCard.mockRejectedValueOnce(new Error('portal down'));
  await expect(loadIdCard()).rejects.toThrow('portal down');

  fetchCard.mockResolvedValueOnce('JVBERpdf');
  await loadIdCard();
  fetchCard.mockRejectedValueOnce(new Error('portal down'));
  const result = await loadIdCard();
  expect(result).toMatchObject({
    fromCache: true,
    expired: false,
    data: { png: 'PNGDATA' },
  });
});

test('clearing removes the saved card', async () => {
  fetchCard.mockResolvedValue('JVBERpdf');
  await loadIdCard();
  await clearCachedIdCard();
  expect(await readCachedIdCard()).toBeNull();
});
