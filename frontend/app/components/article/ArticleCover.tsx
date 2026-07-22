import Image from 'next/image';
import { canUseNextImage, isVideoUrl } from '@/app/lib/imageUtils';

interface ArticleCoverProps {
  featuredImage?: string | null;
  title: string;
  className?: string;
  priority?: boolean;
}

export default function ArticleCover({
  featuredImage,
  title,
  className = '',
  priority = false,
}: ArticleCoverProps) {
  if (!featuredImage) {
    return (
      <div
        role="img"
        aria-label={title}
        className={`relative w-full bg-black rounded-lg overflow-hidden ${className}`}
        style={{ aspectRatio: '1200 / 630' }}
      />
    );
  }

  const isVideo = isVideoUrl(featuredImage);

  return (
    <div className={`relative w-full bg-black rounded-lg overflow-hidden ${className}`}>
      {isVideo ? (
        <video
          className="w-full h-auto object-cover"
          src={featuredImage}
          controls={false}
          autoPlay
          loop
          muted
          playsInline
          title={title}
          preload="metadata"
        />
      ) : canUseNextImage(featuredImage) ? (
        <Image
          src={featuredImage}
          alt={title}
          width={1200}
          height={630}
          sizes="(max-width: 768px) 100vw, 800px"
          className="w-full h-auto object-cover"
          priority={priority}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={featuredImage}
          alt={title}
          loading={priority ? 'eager' : 'lazy'}
          width={1200}
          height={630}
          className="w-full h-auto object-cover"
        />
      )}
    </div>
  );
}
