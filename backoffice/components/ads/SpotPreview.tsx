'use client';

import { EyeOff } from 'lucide-react';
import { fitFormat, type MediaType } from './spots';

// The spot as the site draws it, at its ratio: the banner cropped to fill the
// box (object-fit: cover, like the site), the ad network, or nothing.
export function SpotPreview({
  format,
  show,
  mediaUrl,
  mediaType,
  title,
  maxWidth,
  maxHeight,
}: {
  format: string;
  show: 'adsense' | 'custom' | 'off';
  mediaUrl?: string;
  mediaType?: MediaType;
  title?: string;
  maxWidth: number;
  maxHeight: number;
}) {
  const { width, height } = fitFormat(format, maxWidth, maxHeight);
  const roomy = height >= 26 && width >= 72;
  const tall = height >= 44;

  if (show === 'custom' && mediaUrl) {
    return (
      <div className="pub-apercu" style={{ width, height }}>
        {mediaType === 'video' ? (
          <video src={mediaUrl} muted loop playsInline autoPlay aria-label={title || 'Bannière vidéo'} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt={title || 'Bannière'} />
        )}
      </div>
    );
  }
  if (show === 'off') {
    return (
      <div className="pub-apercu masque" style={{ width, height }} role="img" aria-label="Emplacement masqué">
        {roomy && (
          <span>
            {tall && <EyeOff aria-hidden="true" />}
            Masqué
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="pub-apercu regie" style={{ width, height }} role="img" aria-label="Annonce de la régie Google">
      {roomy && (
        <span>
          Régie Google
          {tall && <small>{format.replace('x', ' × ')}</small>}
        </span>
      )}
    </div>
  );
}
