// Single door to the backend.
//
// The session is an httpOnly cookie: no script of this page can read it. Calls
// go to this origin, where Next proxies /api/bo to the Go backend (see
// next.config.ts), so the cookie is first-party. Only file uploads go straight
// to the backend, with a short-lived ticket: the proxy caps request bodies far
// below a cover video.

export const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100').replace(/\/$/, '');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr').replace(/\/$/, '');

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
  anonymous?: boolean; // login steps: a refusal is an answer, not a lost session
}

let ticket: { value: string; until: number } | null = null;

// uploadTicket is the pass for the upload routes, reused for a few minutes.
export async function uploadTicket(): Promise<string> {
  if (ticket && ticket.until > Date.now()) return ticket.value;
  const res = await api<{ ticket: string; expires_in: number }>('/upload-ticket', { method: 'POST' });
  ticket = { value: res.ticket, until: Date.now() + (res.expires_in - 60) * 1000 };
  return res.ticket;
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.form) {
    headers.Authorization = `Upload ${await uploadTicket()}`;
    return fetch(`${BACKEND_URL}/api/bo${path}`, { method: opts.method || 'POST', headers, body: opts.form, signal: opts.signal });
  }
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  return fetch(`/api/bo${path}`, {
    method: opts.method || (body ? 'POST' : 'GET'),
    headers,
    body,
    signal: opts.signal,
    credentials: 'same-origin',
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
  } catch (e) {
    if (e instanceof ApiError) throw e;
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
      ticket = null;
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
