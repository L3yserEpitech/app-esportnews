'use client';

import { useEffect, useState } from 'react';
import ArticleContent from './ArticleContent';

interface ArticleBodyProps {
  contentDark: string;
  contentLight: string;
}

/**
 * Picks the dark- or light-themed content variant based on the
 * `data-theme` attribute set on <html> by ThemeProvider.
 *
 * Server-renders the dark variant by default (matching the site's
 * default theme-color #060B13). On hydration, swaps to the light
 * variant if the user has chosen a light theme.
 */
export default function ArticleBody({ contentDark, contentLight }: ArticleBodyProps) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const read = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsLight(theme === 'light');
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const content = isLight ? contentLight || contentDark : contentDark || contentLight;
  return <ArticleContent content={content} isDarkMode={!isLight} />;
}
