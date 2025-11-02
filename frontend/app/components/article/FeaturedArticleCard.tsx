'use client';

import { NewsItem } from '@/app/types';

interface FeaturedArticleCardProps {
  article: NewsItem;
  onClick?: (slug: string) => void;
}

export default function FeaturedArticleCard({ article, onClick }: FeaturedArticleCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Détecter si c'est une vidéo basé sur l'extension du fichier
  const isVideo = article.featuredImage && /\.(mp4|webm|ogg|mov|avi)$/i.test(article.featuredImage);

  const handleClick = () => {
    if (onClick) {
      onClick(article.slug);
    } else {
      window.location.href = `/article/${article.slug}`;
    }
  };

  return (
    <article
      className="group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl relative h-[500px] mt-2"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Lire l'article: ${article.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Image or Video pleine */}
      <div className="relative w-full h-full overflow-hidden bg-black">
        {isVideo ? (
          <video
            className="w-full h-full object-cover transition-all duration-[500ms] group-hover:scale-103"
            src={article.featuredImage}
            autoPlay
            controls={false}
            loop
            muted
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            onError={(e) => {
              console.error('Erreur de chargement vidéo:', e.currentTarget.error?.code);
            }}
          />
        ) : (
          <img
            src={article.featuredImage}
            alt={article.title}
            className="w-full h-full object-cover transition-all duration-[500ms] group-hover:scale-103"
            loading="eager"
          />
        )}

        {/* Gradient overlay en bas */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Contenu en superposition (bas gauche) */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          {/* Category badge */}
          <div className="mb-4">
            <span className="inline-block bg-pink-600 text-white px-4 py-2 rounded text-xs font-medium uppercase">
              {article.category}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            {article.title}
          </h2>

          {/* Meta info (date et auteur) */}
          <div className="flex items-center space-x-3 text-sm text-gray-300">
            <span>{formatDate(article.created_at)}</span>
            <span>•</span>
            <span>{article.author}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
