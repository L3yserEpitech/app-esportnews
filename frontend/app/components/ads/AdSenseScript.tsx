'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { loadAdSense } from '@/app/lib/adsenseLoader';

// Loads AdSense once the page has hydrated (see lib/adsenseLoader.ts). The
// script also brings Google's consent message for EEA visitors. Not on the
// back-office nor on the sign-in pages: no ad there, and no reason to ask.
export default function AdSenseScript() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/auth')) return;
    loadAdSense();
  }, [pathname]);

  return null;
}
