'use client';

import { useRouter } from 'next/navigation';
import { openConsentSettings } from '@/app/lib/cookieConsent';

interface ConsentSettingsLinkProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// Reopens Google's consent message. Where none applies (outside the EEA, ad
// blocker), the cookie policy is the only useful place to send the visitor.
export default function ConsentSettingsLink({ children, className, style }: ConsentSettingsLinkProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => {
        if (!openConsentSettings()) router.push('/legal/cookies#gerer');
      }}
    >
      {children}
    </button>
  );
}
