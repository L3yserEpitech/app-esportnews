interface AdSkeletonProps {
  className?: string;
}

const AdSkeleton: React.FC<AdSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden rounded-xl animate-pulse bg-gray-800/50 ${className}`}>
      {/* Image placeholder */}
      <div className="w-full h-96 bg-gray-700/50 rounded-xl">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-800/80 via-gray-800/20 to-transparent" />

        {/* Bottom content placeholder */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="space-y-2">
            <div className="h-4 bg-gray-600/50 rounded w-3/4"></div>
            <div className="h-3 bg-gray-600/30 rounded w-1/3"></div>
          </div>
        </div>
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
    </div>
  );
};

export default AdSkeleton;