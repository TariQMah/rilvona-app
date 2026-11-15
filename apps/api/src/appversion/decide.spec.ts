import { decideUpdate } from './decide';

function serviceWith(config: typeof base | null) {
  return { check: async (_platform: string, code: number) => decideUpdate(config, code) };
}

const base = {
  latestVersionCode: 5,
  latestVersionName: '1.0.0',
  minVersionCode: 3,
  forceUpdate: false,
  releaseNotes: 'Faster ID card',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.ainor.hiihive',
};

describe('app version check', () => {
  it('asks for nothing when the build is current', async () => {
    const result = await serviceWith(base).check('ANDROID', 5);
    expect(result).toMatchObject({ updateAvailable: false, updateRequired: false });
  });

  it('offers an update to an older build that is still allowed', async () => {
    const result = await serviceWith(base).check('ANDROID', 4);
    expect(result).toMatchObject({ updateAvailable: true, updateRequired: false, releaseNotes: 'Faster ID card' });
  });

  it('blocks builds below the minimum version', async () => {
    const result = await serviceWith(base).check('ANDROID', 2);
    expect(result).toMatchObject({ updateAvailable: true, updateRequired: true });
  });

  it('blocks every older build when the update is forced', async () => {
    const forced = serviceWith({ ...base, forceUpdate: true });
    expect(await forced.check('ANDROID', 4)).toMatchObject({ updateRequired: true });
    expect(await forced.check('ANDROID', 5)).toMatchObject({ updateRequired: false });
  });

  it('never blocks when nothing is configured', async () => {
    const result = await serviceWith(null).check('IOS', 1);
    expect(result).toMatchObject({ updateAvailable: false, updateRequired: false });
  });
});
