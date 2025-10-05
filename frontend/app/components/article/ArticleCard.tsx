'use client';

import { NewsItem } from '@/app/types';

interface ArticleCardProps {
  article: NewsItem;
  onClick?: (slug: string) => void;
}

export default function ArticleCard({ article, onClick }: ArticleCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleClick = () => {
    if (onClick) {
      onClick(article.slug);
    } else {
      window.location.href = `/article/${article.slug}`;
    }
  };

  return (
    <article
      className="group cursor-pointer bg-gradient-to-br from-pink-500/10 to-blue-600/10 border border-pink-500/20 rounded-lg rounded-lg overflow-hidden transition-all duration-300 hover:shadow-xl"
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
      {/* Image */}
      <div className="relative h-64 overflow-hidden">
        <img
          src={article.featuredImage}
          alt={article.title}
          className="w-full h-full object-cover transition-all duration-[500ms] group-hover:scale-102"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Category */}
        <span className="inline-block bg-pink-600 text-white px-3 py-1 rounded text-xs font-medium uppercase mb-3">
          {article.category}
        </span>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-3 line-clamp-2">
          {article.title}
        </h3>

        {/* Description */}
        <p className="text-gray-400 text-sm line-clamp-3 mb-4">
          {article.description}
        </p>

        {/* Meta info */}
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <span>{formatDate(article.created_at)}</span>
          <span>•</span>
          <span>{article.readTime} min</span>
          <span>•</span>
          <span>{article.author}</span>
        </div>
      </div>
    </article>
  );
}
