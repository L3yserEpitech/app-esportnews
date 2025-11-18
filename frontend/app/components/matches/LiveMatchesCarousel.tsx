import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations();
  const carouselOptions = useMemo(() => ({
    align: "start" as const,
    loop: false,
  }), []);

  const matchList = matches ?? [];
  const showNavigation = useMemo(() => matchList.length > 1, [matchList.length]);

  if (matchList.length === 0) {
    return (
      null
    );
  }

  return (
    <div className="relative overflow-hidden">
      <Carousel
        opts={carouselOptions}
        className="w-full max-w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4 overflow-visible">
          {matchList.map((match) => (
            <CarouselItem key={match.id} className="pl-2 md:pl-4 basis-[320px] md:basis-[350px] lg:basis-[380px] flex-shrink-0">
              <div className="w-full max-w-full">
                <LiveMatchCard match={match} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {showNavigation && (
          <>
            <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 bg-bg-secondary border-border-secondary hover:bg-bg-tertiary text-text-primary z-10" />
            <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 bg-bg-secondary border-border-secondary hover:bg-bg-tertiary text-text-primary z-10" />
          </>
        )}
      </Carousel>
    </div>
  );
}