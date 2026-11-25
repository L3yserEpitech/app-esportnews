import type { NextConfig } from 'next';

// The back-office is never meant to be found or framed: no indexing, no
// embedding, and scripts only from itself (plus Google's sign-in button).
const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets several dev servers run from this folder at once (one build folder each).
  distDir: process.env.BO_DIST_DIR || '.next',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // The browser only ever talks to this origin: the session cookie is then
  // first-party and httpOnly, wherever the Go backend is hosted.
  async rewrites() {
    const backend = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100').replace(/\/$/, '');
    return [{ source: '/api/bo/:path*', destination: `${backend}/api/bo/:path*` }];
  },
};

export default nextConfig;
