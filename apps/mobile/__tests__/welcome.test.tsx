import { act, create } from 'react-test-renderer';
import { WelcomeScreen } from '../src/screens/auth/AuthScreens';
import { apiData } from '../src/api/client';
import { useSession } from '../src/api/session';
import { getGoogleIdToken } from '../src/auth/google';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockClear = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: mockClear }),
}));

jest.mock('../src/auth/google', () => ({
  getGoogleIdToken: jest.fn(),
  signOutOfGoogle: jest.fn(),
}));

jest.mock('../src/api/client', () => ({ apiData: jest.fn() }));

jest.mock('../src/cuims/credentials', () => ({
  releaseCredentialsNotOwnedBy: jest.fn(async () => undefined),
}));

jest.mock('../src/screens/academics/LegalSheet', () => ({
  LegalSheet: ({ kind }: { kind: string | null }) => {
    const { Text } = require('react-native');
    return kind ? <Text>{`legal:${kind}`}</Text> : null;
  },
}));

const textOf = (node: unknown): string => {
  const n = node as { children?: unknown[] } | string | null;
  if (n == null) return '';
  if (typeof n === 'string') return n;
  return (n.children ?? []).map(textOf).join(' ');
};

function render() {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<WelcomeScreen />);
  });
  return tree;
}

const checkbox = (tree: ReturnType<typeof create>) =>
  tree.root.findByProps({ accessibilityRole: 'checkbox' });
const googleButton = (tree: ReturnType<typeof create>) =>
  tree.root.findByProps({ accessibilityLabel: 'Continue with Google' });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(useSession.getState(), 'setSession').mockResolvedValue(undefined);
});

test('welcome shows the tagline, Google as the only way in, and a terms checkbox', () => {
  const tree = render();
  const text = textOf(tree.toJSON());
  expect(text).toContain('Rilvona');
  expect(text).toContain('Your smart companion for university life');
  expect(text).toContain('Continue with Google');
  expect(text).toContain('Terms and conditions');
  expect(text).toContain('Privacy policy');
  expect(text).not.toMatch(/Create account|Sign in|password/i);
  expect(checkbox(tree).props.accessibilityState.checked).toBe(false);
});

test('Google does not open until the terms are accepted', async () => {
  const tree = render();
  await act(async () => {
    await googleButton(tree).props.onPress();
  });
  expect(getGoogleIdToken).not.toHaveBeenCalled();
  expect(textOf(tree.toJSON())).toContain(
    'agree to the Terms and Privacy policy',
  );
});

test('a Google sign in sends the token with the accepted terms and stores the session', async () => {
  (getGoogleIdToken as jest.Mock).mockResolvedValue('google-token');
  const result = {
    user: { id: 'u1' },
    tokens: { accessToken: 'a', refreshToken: 'r' },
  };
  (apiData as jest.Mock).mockResolvedValue(result);
  const tree = render();
  act(() => checkbox(tree).props.onPress());
  expect(checkbox(tree).props.accessibilityState.checked).toBe(true);
  await act(async () => {
    await googleButton(tree).props.onPress();
  });
  expect(apiData).toHaveBeenCalledWith(
    '/auth/google',
    expect.objectContaining({
      method: 'POST',
      auth: false,
      body: JSON.stringify({
        idToken: 'google-token',
        acceptedTerms: true,
        acceptedPrivacy: true,
      }),
    }),
  );
  expect(useSession.getState().setSession).toHaveBeenCalledWith({
    accessToken: 'a',
    refreshToken: 'r',
    user: { id: 'u1' },
  });
  // The cache must be emptied before the session opens the dashboard, never after.
  expect(mockClear.mock.invocationCallOrder[0]).toBeLessThan(
    (useSession.getState().setSession as jest.Mock).mock.invocationCallOrder[0],
  );
});

test('backing out of the Google chooser does nothing, and a failure is shown', async () => {
  const tree = render();
  act(() => checkbox(tree).props.onPress());

  (getGoogleIdToken as jest.Mock).mockResolvedValueOnce(null);
  await act(async () => {
    await googleButton(tree).props.onPress();
  });
  expect(apiData).not.toHaveBeenCalled();

  (getGoogleIdToken as jest.Mock).mockRejectedValueOnce(
    new Error('Google sign in did not finish.'),
  );
  await act(async () => {
    await googleButton(tree).props.onPress();
  });
  expect(textOf(tree.toJSON())).toContain('Google sign in did not finish.');
});

test('the terms and privacy links open the legal sheet', () => {
  const tree = render();
  const links = tree.root.findAll(
    n =>
      typeof n.props.onPress === 'function' && (n.type as unknown) === 'Text',
  );
  act(() => links[0].props.onPress());
  expect(textOf(tree.toJSON())).toContain('legal:terms');
});
