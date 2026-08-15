'use client';

import TournamentBracket from '../../../components/tournaments/TournamentBracket';
import type { TournamentSectionProps } from './shared';

export default function BracketSection({ tournament }: TournamentSectionProps) {
  // TournamentBracket scrolls horizontally (overflow-x-auto), so it works on
  // mobile too — no md-breakpoint gate.
  return <TournamentBracket matches={tournament.matches || []} />;
}
