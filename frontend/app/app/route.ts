import { NextResponse } from 'next/server';
import { storeUrlForUserAgent } from '@/app/lib/appPromo';

// Single download link, printed in the app QR code: the phone that scans it
// lands on its own store.
export function GET(request: Request) {
  return NextResponse.redirect(storeUrlForUserAgent(request.headers.get('user-agent')), 302);
}
