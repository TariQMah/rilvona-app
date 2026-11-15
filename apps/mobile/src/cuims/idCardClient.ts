import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { fetchVirtualIdCard } from './client';

const CACHE_KEY = 'hiihive:idcard:v1';
/** The card is credit-card sized; this width keeps the text and QR code sharp on a phone screen. */
const RENDER_WIDTH = 1200;
/** Width over height of the portal's card page, used to size the picture before it is drawn. */
export const ID_CARD_ASPECT = 243.792 / 153.072;

export type IdCard = {
  /** The card as a PNG, base64 encoded. */
  png: string;
  fetchedAt: string;
};

export type IdCardResult = {
  data: IdCard | null;
  /** The card shown is the copy saved on this phone, not one downloaded just now. */
  fromCache: boolean;
  /** The saved portal session has expired, so a fresh login is needed to update. */
  expired: boolean;
};

type PdfRenderNative = {
  renderFirstPage: (pdfBase64: string, width: number) => Promise<string>;
};

export async function readCachedIdCard(): Promise<IdCard | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdCard;
    return typeof parsed.png === 'string' && parsed.png.length > 0
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function clearCachedIdCard(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
}

async function renderCard(pdfBase64: string): Promise<string> {
  const native = NativeModules.PdfRender as PdfRenderNative | undefined;
  if (!native) {
    throw new Error('Showing the ID card is not supported on this device yet.');
  }
  return native.renderFirstPage(pdfBase64, RENDER_WIDTH);
}

/**
 * The student's virtual ID card: downloaded from the portal with the saved session, drawn into a picture on this
 * phone, and kept on the phone only. When the session has expired or the portal is unreachable, the saved copy shows.
 */
export async function loadIdCard(): Promise<IdCardResult> {
  let pdf: string | null = null;
  let reachable = true;
  let failure: unknown = null;
  try {
    pdf = await fetchVirtualIdCard();
  } catch (error) {
    reachable = false;
    failure = error;
  }
  const cached = await readCachedIdCard();
  if (pdf === null && reachable) {
    return { data: cached, fromCache: true, expired: true };
  }
  if (pdf === null) {
    if (cached) return { data: cached, fromCache: true, expired: false };
    throw failure instanceof Error
      ? failure
      : new Error('Could not reach the portal. Try again later.');
  }
  const data: IdCard = {
    png: await renderCard(pdf),
    fetchedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(
    () => undefined,
  );
  return { data, fromCache: false, expired: false };
}
