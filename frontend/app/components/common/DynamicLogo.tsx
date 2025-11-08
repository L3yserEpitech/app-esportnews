'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface DynamicLogoProps {
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export default function DynamicLogo({ width, height, className, priority = false }: DynamicLogoProps) {
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Détecter le thème au montage
    const theme = document.documentElement.getAttribute('data-theme');
    setIsDarkTheme(theme !== 'light');
    setMounted(true);

    // Observer les changements de thème
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkTheme(theme !== 'light');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    // Retourner un logo par défaut en attendant le montage
    return (
      <Image
        src="/logo_blanc.png"
        alt="EsportNews"
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    );
  }

  return (
    <Image
      src={isDarkTheme ? '/logo_blanc.png' : '/logo_noir.png'}
      alt="EsportNews"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
