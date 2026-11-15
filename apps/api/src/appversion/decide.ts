export type VersionRules = {
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  forceUpdate: boolean;
  releaseNotes: string;
  storeUrl: string;
};

/** What an installed build needs to do: nothing, offer an update, or stop until it updates. */
export function decideUpdate(rules: VersionRules | null, versionCode: number) {
  if (!rules) {
    return {
      updateAvailable: false,
      updateRequired: false,
      latestVersionCode: versionCode,
      latestVersionName: '',
      minVersionCode: 0,
      releaseNotes: '',
      storeUrl: '',
    };
  }
  const behind = versionCode < rules.latestVersionCode;
  return {
    updateAvailable: behind,
    updateRequired: versionCode < rules.minVersionCode || (rules.forceUpdate && behind),
    latestVersionCode: rules.latestVersionCode,
    latestVersionName: rules.latestVersionName,
    minVersionCode: rules.minVersionCode,
    releaseNotes: rules.releaseNotes,
    storeUrl: rules.storeUrl,
  };
}
