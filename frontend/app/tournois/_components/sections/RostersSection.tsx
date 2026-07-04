'use client';

import TeamsRosters from '../../../components/tournaments/TeamsRosters';
import type { TournamentSectionProps } from './shared';

export default function RostersSection({ tournament }: TournamentSectionProps) {
  return <TeamsRosters tournament={tournament} />;
}
