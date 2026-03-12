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
import FeaturedMatchCard from './FeaturedMatchCard';

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
        <CarouselContent className="-ml-3 overflow-visible">
          {matchList.map((match) => (
            <CarouselItem key={match.id} className="pl-3 basis-[300px] sm:basis-[360px] flex-shrink-0">
              <FeaturedMatchCard match={match} />
            </CarouselItem>
          ))}
        </CarouselContent>
        {showNavigation && (
          <>
            <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2 !size-10 bg-[var(--color-bg-primary)]/90 backdrop-blur-sm border border-[var(--color-border-primary)]/60 hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]/40 text-[var(--color-text-primary)] shadow-lg shadow-black/30 z-10 [&_svg]:!size-5" />
            <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2 !size-10 bg-[var(--color-bg-primary)]/90 backdrop-blur-sm border border-[var(--color-border-primary)]/60 hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]/40 text-[var(--color-text-primary)] shadow-lg shadow-black/30 z-10 [&_svg]:!size-5" />
          </>
        )}
      </Carousel>
    </div>
  );
}
