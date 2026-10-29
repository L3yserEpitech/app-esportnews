export type RefreshOutcome = 'renewed' | 'rejected' | 'unavailable';

// Only the backend refusing the token ends the session. Anything else (no
// network, timeout, backend restarting, rate limit) is a reason to try again
// at the next 401, not to sign the user out.
export function classifyRefreshFailure(error: unknown): Exclude<RefreshOutcome, 'renewed'> {
  const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
  return status === 400 || status === 401 ? 'rejected' : 'unavailable';
}
