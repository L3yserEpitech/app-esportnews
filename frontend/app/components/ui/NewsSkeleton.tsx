interface NewsSkeletonProps {
  className?: string;
  variant?: 'featured' | 'list';
}

const NewsSkeleton: React.FC<NewsSkeletonProps> = ({
  className = '',
  variant = 'featured'
}) => {
  if (variant === 'featured') {
    return (
      <div className={`relative overflow-hidden rounded-xl animate-pulse bg-gray-800/50 ${className}`}>
        {/* Image placeholder */}
        <div className="w-full h-48 md:h-64 bg-gray-700/50 rounded-xl">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-800/80 via-gray-800/20 to-transparent" />

          {/* Bottom content placeholder */}
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center space-x-2 mb-2">
              <div className="h-5 bg-gray-600/50 rounded w-16"></div>
              <div className="h-3 bg-gray-600/30 rounded w-20"></div>
              <div className="h-3 bg-gray-600/30 rounded w-16"></div>
            </div>

            <div className="space-y-2 mb-3">
              <div className="h-6 bg-gray-600/50 rounded w-3/4"></div>
              <div className="h-4 bg-gray-600/30 rounded w-1/2"></div>
            </div>

            <div className="flex items-center justify-between">
              <div className="h-3 bg-gray-600/30 rounded w-24"></div>
              <div className="h-3 bg-gray-600/30 rounded w-16"></div>
            </div>
          </div>
        </div>

        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl animate-pulse bg-gray-800/50 ${className}`}>
      {/* Image placeholder */}
      <div className="w-full h-32 bg-gray-700/50 rounded-t-xl">
        <div className="absolute top-2 left-2">
          <div className="h-5 bg-gray-600/50 rounded w-16"></div>
        </div>
      </div>

      {/* Content placeholder */}
      <div className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <div className="h-3 bg-gray-600/30 rounded w-16"></div>
          <div className="h-3 bg-gray-600/30 rounded w-12"></div>
          <div className="h-3 bg-gray-600/30 rounded w-14"></div>
        </div>

        <div className="space-y-2 mb-2">
          <div className="h-4 bg-gray-600/50 rounded w-full"></div>
          <div className="h-4 bg-gray-600/50 rounded w-2/3"></div>
        </div>

        <div className="space-y-1 mb-3">
          <div className="h-3 bg-gray-600/30 rounded w-full"></div>
          <div className="h-3 bg-gray-600/30 rounded w-3/4"></div>
        </div>

        <div className="flex items-center justify-between">
          <div className="h-3 bg-gray-600/30 rounded w-20"></div>
          <div className="flex space-x-1">
            <div className="h-5 bg-gray-600/30 rounded w-12"></div>
            <div className="h-5 bg-gray-600/30 rounded w-12"></div>
          </div>
        </div>
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
    </div>
  );
};

export default NewsSkeleton;