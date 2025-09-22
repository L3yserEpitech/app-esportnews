import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { LiveMatch } from '../../types';
import LiveMatchCard from './LiveMatchCard';

interface LiveMatchesCarouselProps {
  matches: LiveMatch[];
  isLoading: boolean;
}

export default function LiveMatchesCarousel({ matches, isLoading }: LiveMatchesCarouselProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12 bg-gray-900 rounded-lg">
        <div className="text-gray-400 text-lg mb-2">
          ⏳ Chargement des matchs...
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900 rounded-lg">
        <div className="text-gray-400 text-lg mb-2">
          🎮 Aucun match en direct
        </div>
        <p className="text-gray-500 text-sm">
          Aucun match en cours pour le moment !
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full max-w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4 overflow-visible">
          {matches.map((match) => (
            <CarouselItem key={match.id} className="pl-2 md:pl-4 basis-[320px] md:basis-[350px] lg:basis-[380px] flex-shrink-0">
              <div className="w-full max-w-full">
                <LiveMatchCard match={match} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {matches.length > 1 && (
          <>
            <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white z-10" />
            <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white z-10" />
          </>
        )}
      </Carousel>
    </div>
  );
}