import { NativeModules, Platform } from 'react-native';
import { apiData } from '../api/client';

export type UpdateCheck = {
  /** A newer build exists. */
  updateAvailable: boolean;
  /** This build is no longer allowed to run until it is updated. */
  updateRequired: boolean;
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  releaseNotes: string;
  storeUrl: string;
};

type AppInfoNative = { versionCode: number; versionName: string };

/** The build that is installed, or null where the native side does not report it (tests, iOS for now). */
export function installedBuild(): AppInfoNative | null {
  const native = NativeModules.AppInfo as AppInfoNative | undefined;
  if (!native || typeof native.versionCode !== 'number') return null;
  return native;
}

/**
 * Asks the server whether this build may keep running. Never throws: when the server cannot be reached the app
 * carries on, because a network problem must not lock students out.
 */
export async function checkForUpdate(): Promise<UpdateCheck | null> {
  const build = installedBuild();
  if (!build) return null;
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  try {
    return await apiData<UpdateCheck>(
      `/app/version?platform=${platform}&versionCode=${build.versionCode}`,
      { auth: false },
    );
  } catch {
    return null;
  }
}
