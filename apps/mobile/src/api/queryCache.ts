import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

const PREFIX = 'rilvona_query_cache_v1:';
const VERSION = 1;

/** Screens that should still open from the last successful load when there is no network. */
const PERSISTED = new Set(['academics', 'notifications', 'me']);

type Entry = { queryKey: QueryKey; data: unknown };
type Payload = { version: number; savedAt: string; queries: Entry[] };

const storageKey = (userId: string) => `${PREFIX}${userId}`;

const rootOf = (key: QueryKey) =>
  typeof key[0] === 'string' ? key[0] : undefined;

const shouldPersist = (key: QueryKey) => {
  const root = rootOf(key);
  return !!root && PERSISTED.has(root);
};

export async function restoreQueryCache(
  client: QueryClient,
  userId: string,
): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Payload;
    if (parsed.version !== VERSION || !Array.isArray(parsed.queries)) return 0;
    let count = 0;
    for (const entry of parsed.queries) {
      if (!entry || !Array.isArray(entry.queryKey) || entry.data === undefined)
        continue;
      if (!shouldPersist(entry.queryKey)) continue;
      client.setQueryData(entry.queryKey, entry.data);
      count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

async function writeQueryCache(client: QueryClient, userId: string) {
  const queries: Entry[] = [];
  for (const query of client.getQueryCache().getAll()) {
    if (!shouldPersist(query.queryKey) || query.state.data === undefined)
      continue;
    queries.push({ queryKey: query.queryKey, data: query.state.data });
  }
  if (queries.length === 0) return;
  const payload: Payload = {
    version: VERSION,
    savedAt: new Date().toISOString(),
    queries,
  };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(payload)).catch(
    () => undefined,
  );
}

/** Writes the persisted queries whenever one of them changes. Call again after sign-in. */
export function subscribeQueryCache(
  client: QueryClient,
  userId: string,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    void writeQueryCache(client, userId);
  };
  const unsub = client.getQueryCache().subscribe(event => {
    if (!event.query || !shouldPersist(event.query.queryKey)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 250);
  });
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}

export async function clearQueryCache(userId?: string): Promise<void> {
  try {
    if (userId) {
      await AsyncStorage.removeItem(storageKey(userId));
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(key => key.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // A failed clear must not block sign-out.
  }
}
