// Per-wiki section registry for the modular match detail page.
// A "tier" is a named preset; a wiki maps to a preset (or an explicit list).
// Sections each render from PandaMatch and return null when their data is absent.

export const SECTION_IDS = [
  'header', 'gameResults', 'draft', 'playerStats', 'externalLinks', 'stream', 'rosters',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

// Default order = finished-match order (stream sits low). When live, the shell
// promotes 'stream' to index 1 (right after 'header').
const PRESETS: Record<'tier1' | 'valorant' | 'default' | 'smash', SectionId[]> = {
  tier1: ['header', 'gameResults', 'draft', 'playerStats', 'stream', 'rosters', 'externalLinks'],
  // Valorant: gameResults renders per-map blocks embedding draft + stats.
  valorant: ['header', 'gameResults', 'stream', 'rosters', 'externalLinks'],
  default: ['header', 'gameResults', 'stream', 'rosters', 'externalLinks'],
  // Smash: solo-player — fighters/stocks via playerStats; no draft; rosters self-hide.
  smash: ['header', 'gameResults', 'playerStats', 'stream', 'rosters'],
};

// Tier-1 wikis get the rich preset. Everything else uses 'default' (current
// behaviour minus player stats/draft) — so no game regresses.
const PRESET_BY_WIKI: Record<string, keyof typeof PRESETS> = {
  leagueoflegends: 'tier1',
  valorant: 'valorant',
  dota2: 'tier1',
  smash: 'smash',
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
