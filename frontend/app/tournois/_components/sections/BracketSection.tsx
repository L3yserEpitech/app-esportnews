'use client';

import TournamentBracket from '../../../components/tournaments/TournamentBracket';
import type { TournamentSectionProps } from './shared';

export default function BracketSection({ tournament }: TournamentSectionProps) {
  return (
    <div className="hidden md:block">
      <TournamentBracket matches={tournament.matches || []} />
    </div>
  );
}
