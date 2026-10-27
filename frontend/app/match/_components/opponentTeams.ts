import type { PandaOpponent } from '../../types';
import type { Team } from '../../services/teamService';

export type TeamLookup = (template: string, wiki: string, name?: string) => Promise<Team>;

// Resolves each opponent's team page in ONE backend call. The backend already
// tries [[template::…]] then [[name::…]], so the old client-side retries
// (lowercased name, then the hashed opponent id, which never was a pageid) are
// gone: they cost two extra backend requests and up to ten Liquipedia calls per
// opponent for crawlers rendering the page.
export async function loadOpponentTeams(
  opponents: PandaOpponent[] | undefined,
  wiki: string | undefined,
  lookup: TeamLookup,
): Promise<Team[]> {
  if (!wiki || !opponents?.length) return [];

  const teams = await Promise.all(
    opponents.map(async ({ type, opponent }) => {
      if (type && type.toLowerCase() !== 'team') return null; // 1v1 games: no team page
      const name = opponent?.name?.trim();
      const template = opponent?.template || name?.toLowerCase();
      if (!template) return null;
      try {
        return await lookup(template, wiki, name || undefined);
      } catch {
        return null;
      }
    }),
  );
  return teams.filter((team): team is Team => team !== null);
}
