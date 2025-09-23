interface GameCardSkeletonProps {
  className?: string;
}

const GameCardSkeleton: React.FC<GameCardSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`
      relative overflow-hidden rounded-xl animate-pulse
      w-32 h-40 backdrop-blur-sm bg-gray-800/50
      ${className}
    `}>
      {/* Image placeholder */}
      <div className="w-full h-full bg-gray-700/50 rounded-xl">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-800/80 via-gray-800/20 to-transparent" />

        {/* Text placeholder */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <div className="bg-gray-600/50 rounded-lg px-3 py-1.5 border border-gray-500/30">
            <div className="h-3 bg-gray-500/50 rounded mx-auto"></div>
          </div>
        </div>
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer">
      </div>
    </div>
  );
};

export default GameCardSkeleton;