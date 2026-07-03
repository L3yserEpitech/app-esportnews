// Screenshots officiels CS2 hébergés sur GitHub (ghostcap-gaming/cs2-map-images,
// 1920×1080, hotlink libre). Mapping statique nom Liquipedia → fichier ; fallback
// de_<slug> pour les defusal non listées, null si vraiment inconnu → dégradé navy.
const CDN = 'https://raw.githubusercontent.com/ghostcap-gaming/cs2-map-images/main/cs2';

const MAP_FILES: Record<string, string> = {
  ancient: 'de_ancient',
  anubis: 'de_anubis',
  cache: 'de_cache',
  dust2: 'de_dust2',
  'dust ii': 'de_dust2',
  inferno: 'de_inferno',
  mirage: 'de_mirage',
  nuke: 'de_nuke',
  overpass: 'de_overpass',
  train: 'de_train',
  vertigo: 'de_vertigo',
  office: 'cs_office',
  italy: 'cs_italy',
  agency: 'cs_agency',
  edin: 'de_edin',
  basalt: 'de_basalt',
  brewery: 'de_brewery',
  dogtown: 'de_dogtown',
  grail: 'de_grail',
  jura: 'de_jura',
  mills: 'de_mills',
  palacio: 'de_palacio',
  thera: 'de_thera',
  golden: 'de_golden',
};

export function csMapImage(name?: string | null): string | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  const file = MAP_FILES[key] ?? (/^[a-z0-9]+$/.test(key) ? `de_${key}` : null);
  return file ? `${CDN}/${file}.png` : null;
}

// Couleurs de side HLTV : CT bleu, T orange.
export const CS_SIDE_CLASS: Record<string, string> = {
  ct: 'text-sky-400',
  t: 'text-orange-400',
};

export type VetoStep = {
  map: string;
  type: 'ban' | 'pick' | 'decider';
  teamIndex: 0 | 1 | null; // null = decider
};

// Une entrée mapveto peut porter team1 ET team2 (round "pick,pick") ; on la
// déplie en étapes atomiques dans l'ordre du veto.
export function flattenVeto(veto: Array<Record<string, string>>): VetoStep[] {
  const steps: VetoStep[] = [];
  for (const entry of veto) {
    const type = (entry.type || '').toLowerCase();
    if (type === 'decider' || entry.decider) {
      if (entry.decider) steps.push({ map: entry.decider, type: 'decider', teamIndex: null });
      continue;
    }
    if (type !== 'ban' && type !== 'pick') continue;
    if (entry.team1) steps.push({ map: entry.team1, type, teamIndex: 0 });
    if (entry.team2) steps.push({ map: entry.team2, type, teamIndex: 1 });
  }
  return steps;
}
