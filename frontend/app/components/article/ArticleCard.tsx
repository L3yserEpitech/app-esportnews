import Link from 'next/link';
import Image from 'next/image';
import { NewsItem } from '@/app/types';
import { canUseNextImage, isVideoUrl } from '@/app/lib/imageUtils';

interface ArticleCardProps {
  article: NewsItem;
  onClick?: (slug: string) => void;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function CardMedia({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) {
    return <div className="w-full h-full bg-bg-tertiary" aria-hidden="true" />;
  }
  if (isVideoUrl(src)) {
    return (
      <video
        className="w-full h-full object-cover transition-all duration-[500ms] group-hover:scale-103"
        src={src}
        autoPlay={false}
        controls={false}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  if (canUseNextImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        width={800}
        height={600}
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        className="w-full h-full object-cover transition-all duration-[500ms] group-hover:scale-103"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-full h-full object-cover transition-all duration-[500ms] group-hover:scale-103"
    />
  );
}

export default function ArticleCard({ article, onClick }: ArticleCardProps) {
  const href = `/article/${article.slug}`;

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick ? () => onClick(article.slug) : undefined}
      aria-label={`Lire l'article: ${article.title}`}
      className="group block rounded-lg overflow-hidden transition-all duration-300 hover:shadow-xl"
      style={{
        backgroundImage:
          'linear-gradient(to bottom right, rgba(var(--accent-rgb), 0.1), rgba(3, 105, 161, 0.1))',
        borderWidth: '1px',
        borderColor: 'rgba(var(--accent-rgb), 0.2)',
      }}
    >
      <article>
        <div className="relative h-64 overflow-hidden bg-black">
          <CardMedia src={article.featuredImage} alt={article.title} />
        </div>

        <div className="p-6">
          <span
            className="inline-block text-text-inverse px-3 py-1 rounded text-xs font-medium uppercase mb-3"
            style={{ backgroundColor: 'var(--color-accent-hover)' }}
          >
            {article.category}
          </span>

          <h3 className="text-xl font-bold text-text-primary mb-3 line-clamp-2">
            {article.title}
          </h3>

          <p className="text-text-secondary text-sm line-clamp-3 mb-4">
            {article.description}
          </p>

          <div className="flex items-center space-x-2 text-xs text-text-muted">
            <span>{formatDate(article.created_at)}</span>
            <span>•</span>
            <span>{article.readTime} min</span>
            <span>•</span>
            <span>{article.author}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
