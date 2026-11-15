import { act, create } from 'react-test-renderer';
import { SplashScreen } from '../src/components/SplashScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const texts = (tree: ReturnType<typeof create>) =>
  tree.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => node.children.join(''))
    .join(' | ');

test('the splash shows the name and tagline, and reports when it has faded out', () => {
  jest.useFakeTimers();
  const onHidden = jest.fn();
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<SplashScreen visible onHidden={onHidden} />);
  });
  expect(texts(tree)).toContain('Rilvona');
  expect(texts(tree)).toContain('Your smart companion for university life');
  expect(texts(tree)).not.toMatch(/HiiHive/i);

  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(onHidden).not.toHaveBeenCalled();

  act(() => {
    tree.update(<SplashScreen visible={false} onHidden={onHidden} />);
  });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(onHidden).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
  jest.useRealTimers();
});
