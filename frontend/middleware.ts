import { NextResponse, type NextRequest } from 'next/server';
import { isBlockedCrawler } from './app/lib/crawlers';

// robots.txt only asks: a crawler keeps its cached copy for hours or days, and
// some ignore it. A 403 at the edge stops the page load, hence every API call
// the page would make, immediately. robots.txt itself stays readable so the
// disallow can still be picked up.
export function middleware(request: NextRequest) {
  if (isBlockedCrawler(request.headers.get('user-agent'))) {
    return new NextResponse(null, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!robots\\.txt|_next/static|_next/image|favicon\\.ico).*)'],
};
