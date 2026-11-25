'use client';

import { SWRConfig } from 'swr';
import { Shell } from '@/components/Shell';
import { ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/lib/session';
import { ApiError } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        // A refused or missing resource won't appear by asking again.
        shouldRetryOnError: (err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500),
      }}
    >
      <ToastProvider>
        <SessionProvider>
          <Shell>{children}</Shell>
        </SessionProvider>
      </ToastProvider>
    </SWRConfig>
  );
}
