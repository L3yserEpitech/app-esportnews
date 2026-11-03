// The address can hold a reset token, or a password from a form sent before
// hydration by a client on an old bundle. page_views keeps what it gets forever.
export function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0];
}
