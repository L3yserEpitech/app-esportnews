// Single door to the backend. The session token lives in this origin's
// localStorage: admin.esportnews.fr shares nothing with the public site, so a
// script injected there can't read it.

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100').replace(/\/$/, '');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr').replace(/\/$/, '');

const TOKEN_KEY = 'bo_token';
const DEVICE_KEY = 'bo_device';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private window: the session only lasts for this page.
  }
}

export const getToken = () => read(TOKEN_KEY);
export const setToken = (t: string | null) => write(TOKEN_KEY, t);
export const getDeviceToken = () => read(DEVICE_KEY);
export const setDeviceToken = (t: string | null) => write(DEVICE_KEY, t);

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Reauth = () => Promise<boolean>;
let reauthHandler: Reauth | null = null;
let onSessionLost: (() => void) | null = null;

// Wired once by the app shell: how to ask for a code, and what to do when the
// session is gone.
export function configureApi(opts: { reauth: Reauth; sessionLost: () => void }) {
  reauthHandler = opts.reauth;
  onSessionLost = opts.sessionLost;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  raw?: boolean; // return the Response (downloads)
  anonymous?: boolean; // login steps: no token, no redirect
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  const token = opts.anonymous ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  return fetch(`${API_BASE}/api/bo${path}`, {
    method: opts.method || (body ? 'POST' : 'GET'),
    headers,
    body,
    signal: opts.signal,
  });
}

async function toError(res: Response): Promise<ApiError> {
  let code = 'http_' + res.status;
  let message = res.status >= 500 ? 'Le serveur ne répond pas correctement.' : 'La requête a échoué.';
  try {
    const data = await res.json();
    if (data?.code) code = data.code;
    if (data?.error) message = data.error;
    else if (data?.message) message = data.message;
  } catch {
    // Not JSON: keep the generic message.
  }
  return new ApiError(res.status, code, message);
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await send(path, opts);
  } catch {
    throw new ApiError(0, 'network', 'Serveur injoignable. Vérifiez votre connexion.');
  }

  if (!res.ok && !opts.anonymous) {
    const err = await toError(res);
    if (err.code === 'reauth_required' && reauthHandler) {
      // A heavy action: ask for a code, then replay it once.
      if (await reauthHandler()) {
        res = await send(path, opts);
        if (res.ok) return finish<T>(res, opts);
        throw await toError(res);
      }
      throw new ApiError(403, 'reauth_cancelled', 'Action annulée.');
    }
    if (res.status === 401 || err.code === 'not_team') {
      setToken(null);
      onSessionLost?.();
    }
    throw err;
  }
  if (!res.ok) throw await toError(res);
  return finish<T>(res, opts);
}

async function finish<T>(res: Response, opts: RequestOptions): Promise<T> {
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// SWR fetcher: the key is the path.
export const fetcher = <T,>(path: string) => api<T>(path);

// Saves a file the backend streams (CSV and JSON exports).
export async function download(path: string, fallbackName: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const header = res.headers.get('Content-Disposition') || '';
  const name = /filename="?([^";]+)"?/.exec(header)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'Une erreur est survenue.';
}
