import { act, create } from 'react-test-renderer';
import { MenuSheet } from '../src/screens/academics/MenuSheet';
import type { ConnectedOverview } from '../src/screens/academics/model';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const data = {
  connected: true,
  connection: {
    studentUid: '26MCI10238',
    studentName: 'Test Student',
    isDemo: false,
    photo: null,
    lastSyncedAt: null,
  },
} as unknown as ConnectedOverview;

const texts = (tree: ReturnType<typeof create>) =>
  tree.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => node.children.join(''))
    .join(' | ');

const press = (tree: ReturnType<typeof create>, label: string) => {
  const target = tree.root
    .findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        node
          .findAll(n => (n.type as unknown) === 'Text')
          .some(n => n.children.join('') === label),
    )
    .pop();
  if (!target) throw new Error(`no pressable with "${label}"`);
  act(() => target.props.onPress());
};

test('the menu offers Sign out next to Unlink, and asks before signing out', () => {
  jest.useFakeTimers();
  const onSignOut = jest.fn();
  const onUnlink = jest.fn();
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <MenuSheet
        data={data}
        visible
        unlinking={false}
        signingOut={false}
        unreadCount={0}
        onClose={() => undefined}
        onProfile={() => undefined}
        onUpdates={() => undefined}
        onRefresh={() => undefined}
        onPredict={() => undefined}
        onCalendar={() => undefined}
        onDatesheet={() => undefined}
        onIdCard={() => undefined}
        onLegal={() => undefined}
        onUnlink={onUnlink}
        onSignOut={onSignOut}
      />,
    );
  });
  expect(texts(tree)).toContain('Sign out');
  expect(texts(tree)).toContain('Unlink account');

  press(tree, 'Sign out');
  expect(onSignOut).not.toHaveBeenCalled();
  expect(texts(tree)).toContain('Sign out of Rilvona?');

  press(tree, 'Yes, sign me out');
  expect(onSignOut).toHaveBeenCalledTimes(1);
  expect(onUnlink).not.toHaveBeenCalled();
  jest.useRealTimers();
});
