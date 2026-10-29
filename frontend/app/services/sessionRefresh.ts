export type RefreshOutcome = 'renewed' | 'rejected' | 'unavailable';

export const ACCESS_TOKEN_KEY = 'authToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';

export interface TokenStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

// Exchanges the stored refresh token for a new pair. Only a refusal from the
// backend ends the session; an outage or a network failure keeps the tokens
// so the next page load can try again.
export async function refreshStoredSession(
  apiBaseUrl: string,
  store: TokenStore,
  fetchImpl: typeof fetch = fetch
): Promise<RefreshOutcome> {
  const refreshToken = store.get(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    store.remove(ACCESS_TOKEN_KEY);
    return 'rejected';
  }

  let response: Response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    return 'unavailable';
  }

  if (response.status === 400 || response.status === 401) {
    store.remove(ACCESS_TOKEN_KEY);
    store.remove(REFRESH_TOKEN_KEY);
    return 'rejected';
  }
  if (!response.ok) return 'unavailable';

  const data = (await response.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string }
    | null;
  if (!data?.access_token || !data.refresh_token) return 'unavailable';

  store.set(ACCESS_TOKEN_KEY, data.access_token);
  store.set(REFRESH_TOKEN_KEY, data.refresh_token);
  return 'renewed';
}
