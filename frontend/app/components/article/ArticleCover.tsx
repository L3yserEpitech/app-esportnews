'use client';

import { useRef } from 'react';

interface ArticleCoverProps {
  featuredImage: string;
  title: string;
  className?: string;
}

export default function ArticleCover({
  featuredImage,
  title,
  className = '',
}: ArticleCoverProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Détecter si c'est une vidéo basé sur l'extension du fichier
  const isVideo = featuredImage && /\.(mp4|webm|ogg|mov|avi)$/i.test(featuredImage);

  return (
    <div className={`relative w-full bg-black rounded-lg overflow-hidden ${className}`}>
      {isVideo ? (
        <>
          <video
            ref={videoRef}
            className="w-full h-auto object-cover"
            src={featuredImage}
            controls={false}
            autoPlay
            loop
            muted
            playsInline
            title={title}
            preload="metadata"
            poster=""
            crossOrigin="anonymous"
            onError={(e) => {
              console.error('Erreur de chargement vidéo:', e.currentTarget.error?.code);
            }}
          />
        </>
      ) : (
        <img
          className="w-full h-auto object-cover"
          src={featuredImage}
          alt={title}
          loading="lazy"
        />
      )}
    </div>
  );
}
