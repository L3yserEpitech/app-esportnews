'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the active theme is dark.
 * Watches `data-theme` attribute on <html> via MutationObserver,
 * matching the pattern used by ThemeProvider.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(true); // default dark (matches app default)

  useEffect(() => {
    const check = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDark(theme !== 'light');
    };

    check();

    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

/**
 * Picks the right logo URL based on the current theme.
 * In dark mode: prefer darkUrl, fallback to lightUrl.
 * In light mode: always use lightUrl.
 */
export function pickThemeLogo(
  isDark: boolean,
  lightUrl?: string | null,
  darkUrl?: string | null,
): string | undefined {
  if (isDark && darkUrl) return darkUrl;
  return lightUrl || darkUrl || undefined;
}
