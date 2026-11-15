import {
  forgetCuimsCredentials,
  loadCuimsCredentials,
  releaseCredentialsNotOwnedBy,
  saveCuimsCredentials,
} from '../src/cuims/credentials';
import { useSession } from '../src/api/session';

const mockStore = new Map<string, { username: string; password: string }>();
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(
    async ({ service }: { service: string }) => mockStore.get(service) ?? false,
  ),
  setGenericPassword: jest.fn(
    async (
      username: string,
      password: string,
      { service }: { service: string },
    ) => {
      mockStore.set(service, { username, password });
      return true;
    },
  ),
  resetGenericPassword: jest.fn(async ({ service }: { service: string }) => {
    mockStore.delete(service);
    return true;
  }),
}));

const signInAs = (id: string) =>
  useSession.setState({
    user: { id } as never,
    accessToken: 'a',
    refreshToken: 'r',
  });

beforeEach(() => {
  mockStore.clear();
  useSession.setState({ user: null, accessToken: null, refreshToken: null });
});

test('the saved university login survives signing out and back in as the same account', async () => {
  signInAs('u1');
  await saveCuimsCredentials({ uid: '23BCS1', password: 'secret' });
  useSession.setState({ user: null });
  signInAs('u1');
  expect(await loadCuimsCredentials()).toEqual({
    uid: '23BCS1',
    password: 'secret',
  });
});

test('a different account never sees it, and it is deleted', async () => {
  signInAs('u1');
  await saveCuimsCredentials({ uid: '23BCS1', password: 'secret' });
  signInAs('u2');
  expect(await loadCuimsCredentials()).toBeNull();
  signInAs('u1');
  expect(await loadCuimsCredentials()).toBeNull();
});

test('signing in as someone else clears it straight away', async () => {
  signInAs('u1');
  await saveCuimsCredentials({ uid: '23BCS1', password: 'secret' });
  await releaseCredentialsNotOwnedBy('u1');
  expect(mockStore.has('app.hiihive.cuims')).toBe(true);
  await releaseCredentialsNotOwnedBy('u2');
  expect(mockStore.has('app.hiihive.cuims')).toBe(false);
});

test('a login saved before owners existed is adopted by the signed in account, and nothing loads when signed out', async () => {
  mockStore.set('app.hiihive.cuims', { username: '23BCS1', password: 'old' });
  expect(await loadCuimsCredentials()).toBeNull();
  signInAs('u1');
  expect(await loadCuimsCredentials()).toEqual({
    uid: '23BCS1',
    password: 'old',
  });
  expect(mockStore.get('app.hiihive.cuims.owner')?.username).toBe('u1');
  await forgetCuimsCredentials();
  expect(mockStore.size).toBe(0);
});
