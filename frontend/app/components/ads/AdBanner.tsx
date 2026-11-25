'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { AdSpotCreative } from '@/app/lib/adSpots';

interface AdBannerProps {
  creative: AdSpotCreative;
  width: number;
  height: number;
  className?: string;
}

// A banner sold directly: an image or a video, linked to the partner's page.
export default function AdBanner({ creative, width, height, className = '' }: AdBannerProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [creative.media_url]);

  if (hasError) return null;

  const title = creative.title || 'Publicité';

  return (
    <a
      href={creative.redirect_link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={`Publicité : ${title}`}
      className={`group relative block w-full overflow-hidden rounded-lg border border-border-primary ${className}`}
      style={{ maxWidth: width, aspectRatio: `${width} / ${height}` }}
    >
      {creative.media_type === 'video' ? (
        <video
          className="absolute inset-0 h-full w-full object-cover transition-all duration-300 group-hover:brightness-75"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setHasError(true)}
          aria-label={title}
        >
          <source src={creative.media_url} type="video/mp4" />
        </video>
      ) : (
        <Image
          src={creative.media_url}
          alt={title}
          fill
          className="object-cover transition-all duration-300 group-hover:brightness-75"
          onError={() => setHasError(true)}
          loading="lazy"
          sizes={`${width}px`}
        />
      )}

      <div className="absolute bottom-0 left-0 right-0 translate-y-full transform transition-transform duration-300 ease-out group-hover:translate-y-0">
        <div className="bg-gradient-to-t from-black/90 to-transparent p-4">
          <p className="mb-1 text-sm font-semibold text-white">{title}</p>
          <span className="text-xs font-medium text-accent">Publicité</span>
        </div>
      </div>
    </a>
  );
}
