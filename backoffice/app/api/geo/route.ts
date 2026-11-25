import { NextResponse, type NextRequest } from 'next/server';

// The host knows roughly where a request comes from (Vercel sets this header);
// the login page reads it once so the audit log can say « Paris · Mac ».
// Locally there is no header and the log shows the device alone.
export function GET(request: NextRequest) {
  const raw = request.headers.get('x-vercel-ip-city') || '';
  let city = '';
  try {
    city = decodeURIComponent(raw);
  } catch {
    city = raw;
  }
  return NextResponse.json({ city }, { headers: { 'Cache-Control': 'no-store' } });
}
