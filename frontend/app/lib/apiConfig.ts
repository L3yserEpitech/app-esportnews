// Server-side (Docker): use internal Docker network URL to reach the backend container
// Client-side (browser): use public URL (localhost with Docker port mapping)
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
}
