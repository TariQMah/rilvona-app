import { act, create } from 'react-test-renderer';
import { checkPortalSession } from '../src/cuims/client';
import { usePortalSession } from '../src/screens/academics/usePortalSession';

jest.mock('../src/cuims/client', () => ({ checkPortalSession: jest.fn() }));

const mockCheck = checkPortalSession as jest.Mock;

let latest: ReturnType<typeof usePortalSession>;
function Probe({ enabled, paused }: { enabled: boolean; paused: boolean }) {
  latest = usePortalSession(enabled, paused);
  return null;
}

const flush = () => act(async () => {});

beforeEach(() => mockCheck.mockReset());

test('reports an expired session so the dashboard can ask for the captcha', async () => {
  mockCheck.mockResolvedValue('expired');
  await act(async () => {
    create(<Probe enabled paused={false} />);
  });
  expect(mockCheck).toHaveBeenCalledTimes(1);
  expect(latest.expired).toBe(true);
});

test('a live session, or an unreachable portal, never prompts', async () => {
  mockCheck.mockResolvedValue('alive');
  await act(async () => {
    create(<Probe enabled paused={false} />);
  });
  expect(latest.expired).toBe(false);

  mockCheck.mockReset();
  mockCheck.mockResolvedValue('unreachable');
  await act(async () => {
    create(<Probe enabled paused={false} />);
  });
  expect(latest.expired).toBe(false);
});

test('does nothing until the account is linked, and rechecks when the sign in sheet closes', async () => {
  mockCheck.mockResolvedValue('expired');
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Probe enabled={false} paused={false} />);
  });
  expect(mockCheck).not.toHaveBeenCalled();
  expect(latest.expired).toBe(false);

  await act(async () => {
    tree.update(<Probe enabled paused />);
  });
  expect(mockCheck).not.toHaveBeenCalled();

  await act(async () => {
    tree.update(<Probe enabled paused={false} />);
  });
  expect(mockCheck).toHaveBeenCalledTimes(1);
  expect(latest.expired).toBe(true);

  // The student signed in; the next check finds a live session and the banner goes away.
  mockCheck.mockResolvedValue('alive');
  await act(async () => {
    tree.update(<Probe enabled paused />);
  });
  await act(async () => {
    tree.update(<Probe enabled paused={false} />);
  });
  await flush();
  expect(latest.expired).toBe(false);
});
