// Per-wiki section registry for the modular tournament detail page — same
// pattern as match-detail/matchSections.ts. Sections render from
// TournamentSectionProps and return null when their data is absent.

export const SECTION_IDS = [
  'header', 'liveMatches', 'bracket', 'allMatches', 'rosters', 'relatedNews',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

const PRESETS: Record<'default' | 'solo', SectionId[]> = {
  default: ['header', 'liveMatches', 'bracket', 'allMatches', 'rosters', 'relatedNews'],
  // Solo games (1v1): no team rosters — participants are individual players.
  solo: ['header', 'liveMatches', 'bracket', 'allMatches', 'relatedNews'],
};

const PRESET_BY_WIKI: Record<string, keyof typeof PRESETS> = {
  easportsfc: 'solo',
};

export function resolveSections(wiki: string | undefined | null): SectionId[] {
  const presetKey = (wiki && PRESET_BY_WIKI[wiki]) || 'default';
  return [...PRESETS[presetKey]];
}
