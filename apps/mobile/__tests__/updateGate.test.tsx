import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create } from 'react-test-renderer';
import { UpdateGate } from '../src/components/UpdateGate';
import { ThemeProvider } from '../src/theme/ThemeProvider';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const mockCheck = jest.fn();
jest.mock('../src/lib/appVersion', () => ({
  checkForUpdate: () => mockCheck(),
  installedBuild: () => ({ versionCode: 4, versionName: '1.0.0' }),
}));

const base = {
  updateAvailable: true,
  updateRequired: false,
  latestVersionCode: 5,
  latestVersionName: '1.0.0',
  minVersionCode: 1,
  releaseNotes: 'Faster ID card',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.ainor.hiihive',
};

async function render() {
  const client = new QueryClient();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <UpdateGate />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  // Let the mocked check resolve and the query publish its result.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
  return tree;
}

const texts = (tree: ReturnType<typeof create>) =>
  tree.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => node.children.join(''))
    .join(' | ');

test('shows nothing when the build is current', async () => {
  mockCheck.mockResolvedValue({ ...base, updateAvailable: false });
  const tree = await render();
  expect(texts(tree)).toBe('');
});

test('offers a dismissible update when a newer build exists', async () => {
  mockCheck.mockResolvedValue(base);
  const tree = await render();
  expect(texts(tree)).toContain('A new version is ready');
  expect(texts(tree)).toContain('Faster ID card');
  expect(texts(tree)).toContain('Later');
});

test('blocks the app with no way to skip when the update is required', async () => {
  mockCheck.mockResolvedValue({ ...base, updateRequired: true });
  const tree = await render();
  expect(texts(tree)).toContain('Update required');
  expect(texts(tree)).not.toContain('Later');
});

test('lets the app run when the server cannot be reached', async () => {
  mockCheck.mockResolvedValue(null);
  const tree = await render();
  expect(texts(tree)).toBe('');
});
