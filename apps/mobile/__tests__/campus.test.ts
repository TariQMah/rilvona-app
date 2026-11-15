import { cuUidSchema } from '@hiihive/contracts';
import {
  campusBase,
  campusById,
  campusOfUrl,
  getCampus,
  isUniversityHost,
  loadCampus,
  setCampus,
} from '../src/cuims/campus';

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

test('Chandigarh is the default campus', () => {
  expect(getCampus().id).toBe('chandigarh');
  expect(campusBase()).toBe('https://students.cuchd.in/');
});

test('choosing Lucknow switches the portal address and is remembered', async () => {
  await setCampus('lucknow');
  expect(campusBase()).toBe('https://student.culko.in/');
  expect(getCampus().apiHost).toBe('uimsapi.culko.in');
  await setCampus('chandigarh');
  await setCampus('lucknow');
  // a fresh start reads the saved choice
  const loaded = await loadCampus();
  expect(loaded.id).toBe('lucknow');
  await setCampus('chandigarh');
});

test('an unknown saved value falls back to Chandigarh', () => {
  expect(campusById('mars').id).toBe('chandigarh');
  expect(campusById(null).id).toBe('chandigarh');
});

test('only university addresses may be contacted', () => {
  expect(isUniversityHost('https://students.cuchd.in/StudentHome.aspx')).toBe(
    true,
  );
  expect(isUniversityHost('https://student.culko.in/StudentHome.aspx')).toBe(
    true,
  );
  expect(isUniversityHost('http://uimsapi.culko.in/api/homepage/x')).toBe(true);
  expect(isUniversityHost('http://uimsapi.cuchd.in/api/homepage/x')).toBe(true);
  expect(isUniversityHost('https://culko.in.evil.com/')).toBe(false);
  expect(isUniversityHost('https://evilculko.in/')).toBe(false);
  expect(isUniversityHost('http://student.culko.in/')).toBe(false);
  expect(isUniversityHost('https://example.com/')).toBe(false);
});

test('a portal address maps back to its campus', () => {
  expect(campusOfUrl('https://student.culko.in/StudentHome.aspx')?.id).toBe(
    'lucknow',
  );
  expect(campusOfUrl('https://students.cuchd.in/x')?.id).toBe('chandigarh');
  expect(campusOfUrl('https://example.com/')).toBeNull();
});

test('UIDs from either campus pass, junk does not', () => {
  expect(cuUidSchema.safeParse('23bcs10452').data).toBe('23BCS10452');
  expect(cuUidSchema.safeParse('25MCA2038').success).toBe(true);
  expect(cuUidSchema.safeParse('12 34').success).toBe(false);
  expect(cuUidSchema.safeParse('abc').success).toBe(false);
  expect(cuUidSchema.safeParse('23BCS-10452').success).toBe(false);
});
