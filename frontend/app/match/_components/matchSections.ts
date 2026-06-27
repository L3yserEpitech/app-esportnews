// Per-wiki section registry for the modular match detail page.
// A "tier" is a named preset; a wiki maps to a preset (or an explicit list).
// Sections each render from PandaMatch and return null when their data is absent.

export const SECTION_IDS = [
  'header', 'gameResults', 'draft', 'playerStats', 'externalLinks', 'stream', 'rosters', 'matchInfo',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

// Default order = finished-match order (stream sits low). When live, the shell
// promotes 'stream' to index 1 (right after 'header').
const PRESETS: Record<'tier1' | 'default', SectionId[]> = {
  tier1: ['header', 'gameResults', 'draft', 'playerStats', 'externalLinks', 'stream', 'rosters', 'matchInfo'],
  default: ['header', 'gameResults', 'externalLinks', 'stream', 'rosters', 'matchInfo'],
};

// Tier-1 wikis get the rich preset. Everything else uses 'default' (current
// behaviour minus player stats/draft) — so no game regresses.
const PRESET_BY_WIKI: Record<string, keyof typeof PRESETS> = {
  leagueoflegends: 'tier1',
  valorant: 'tier1',
  dota2: 'tier1',
};

export function resolveSections(wiki: string | undefined, isLive: boolean): SectionId[] {
  const presetKey = (wiki && PRESET_BY_WIKI[wiki]) || 'default';
  const base = [...PRESETS[presetKey]];
  if (isLive) {
    const i = base.indexOf('stream');
    if (i > 1) {
      base.splice(i, 1);
      base.splice(1, 0, 'stream');
    }
  }
  return base;
}
