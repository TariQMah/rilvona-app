import { API_BASE_URL } from '../config';
import { ApiError, parseApiError } from '../lib/errors';
import { useSession } from './session';

type RequestOptions = RequestInit & { auth?: boolean; retry?: boolean };

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken() {
  const refreshToken = useSession.getState().refreshToken;
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        await useSession.getState().clear();
        return null;
      }
      const data = body?.data;
      if (!data?.tokens?.accessToken || !data?.tokens?.refreshToken)
        return null;
      await useSession.getState().setSession({
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
        user: data.user,
      });
      return data.tokens.accessToken as string;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, retry = true, headers, ...init } = options;
  const token = useSession.getState().accessToken;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'Check your connection and try again.');
  }

  if (response.status === 401 && auth && retry) {
    const next = await refreshAccessToken();
    if (next) return api<T>(path, { ...options, retry: false });
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) throw parseApiError(response.status, body);
  return body as T;
}

export async function apiData<T>(path: string, options?: RequestOptions) {
  const body = await api<{ data: T }>(path, options);
  return body.data;
}
