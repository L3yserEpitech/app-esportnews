'use client';

import { useEffect } from 'react';
import { usePreferencesContext } from '@/app/contexts/PreferencesContext';
import type { Theme } from '@/lib/preferences';

/**
 * ThemeProvider - Applies theme preference to DOM
 * Listens to preference changes and updates data-theme attribute on <html>
 * Handles 'dark', 'light', and 'auto' themes
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { preferences, isLoading } = usePreferencesContext();
  const theme = preferences.theme;

  useEffect(() => {
    if (isLoading) return;

    // Get the theme to apply
    let themeToApply: 'dark' | 'light' = 'dark';

    if (theme === 'auto') {
      // Use system preference for auto mode
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeToApply = prefersDark ? 'dark' : 'light';
    } else {
      themeToApply = theme;
    }

    // Apply data-theme attribute
    document.documentElement.setAttribute('data-theme', themeToApply);

    // Also set the className for backwards compatibility if needed
    if (themeToApply === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, isLoading]);

  // Listen to system preference changes when in auto mode
  useEffect(() => {
    if (isLoading || theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const prefersDark = mediaQuery.matches;
      const themeToApply = prefersDark ? 'dark' : 'light';

      document.documentElement.setAttribute('data-theme', themeToApply);
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, isLoading]);

  // Never gate `children` on `isLoading`. Preferences are read from a cookie
  // inside an effect, so `isLoading` is always true during server rendering:
  // returning null here rendered the ENTIRE site to an empty <body> in the
  // served HTML — no nav, no h1, no JSON-LD — and only painted after
  // hydration. The theme is applied by the effects above, which touch
  // document attributes only and are already gated on `isLoading`.
  return <>{children}</>;
}
