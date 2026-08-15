// Assets R6 servis depuis des CDN publics (hotlink libre, CORS ouvert), jamais
// depuis liquipedia.net. Mapping statique + normalisation → null si inconnu, donc
// rien ne casse et on retombe sur un dégradé navy.

// Icônes d'opérateurs : SVG de marcopixel/r6operators via jsdelivr (/dist/icons/<slug>.svg).
const OP_CDN = 'https://cdn.jsdelivr.net/npm/r6operators@2.12.0/dist/icons';

// Slugs exacts du package (les noms accentués sont déjà normalisés ASCII).
const OPERATOR_SLUGS = new Set([
  'ace', 'alibi', 'amaru', 'aruni', 'ash', 'azami', 'bandit', 'blackbeard', 'blitz',
  'brava', 'buck', 'capitao', 'castle', 'caveira', 'clash', 'deimos', 'denari', 'doc',
  'dokkaebi', 'echo', 'ela', 'fenrir', 'finka', 'flores', 'frost', 'fuze', 'glaz', 'goyo',
  'gridlock', 'grim', 'hibana', 'iana', 'iq', 'jackal', 'jager', 'kaid', 'kali', 'kapkan',
  'lesion', 'lion', 'maestro', 'maverick', 'melusi', 'mira', 'montagne', 'mozzie', 'mute',
  'nokk', 'nomad', 'oryx', 'osa', 'pulse', 'ram', 'rauora', 'rook', 'sens', 'skopos',
  'sledge', 'smoke', 'solis', 'striker', 'tachanka', 'thatcher', 'thermite', 'thorn',
  'thunderbird', 'tubarao', 'twitch', 'valkyrie', 'vigil', 'wamai', 'warden', 'ying',
  'zero', 'zofia',
]);

// ø/ß ne se décomposent pas en NFD → substitution manuelle (Nøkk).
function operatorSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

export function r6OperatorIcon(name?: string | null): string | null {
  if (!name) return null;
  const slug = operatorSlug(name);
  return OPERATOR_SLUGS.has(slug) ? `${OP_CDN}/${slug}.svg` : null;
}

// Backgrounds de maps : danielwerg/r6data (webp paysage, lair en jpg) via raw GitHub.
const MAP_CDN = 'https://raw.githubusercontent.com/danielwerg/r6data/master/src/assets/maps/backgrounds';

// Clé = nom normalisé alphanumérique (les alias couvrent les noms courts Liquipedia).
const MAP_FILES: Record<string, string> = {
  bank: 'bank.webp',
  border: 'border.webp',
  chalet: 'chalet.webp',
  closequarter: 'close_quarter.webp',
  clubhouse: 'clubhouse.webp',
  coastline: 'coastline.webp',
  consulate: 'consulate.webp',
  emeraldplains: 'emerald_plains.webp',
  favela: 'favela.webp',
  fortress: 'fortress.webp',
  herefordbase: 'hereford_base.webp',
  hereford: 'hereford_base.webp',
  house: 'house.webp',
  kafedostoyevsky: 'kafe_dostoyevsky.webp',
  kafe: 'kafe_dostoyevsky.webp',
  kanal: 'kanal.webp',
  lair: 'lair.jpg',
  nighthavenlabs: 'nighthaven_labs.webp',
  oregon: 'oregon.webp',
  outback: 'outback.webp',
  presidentialplane: 'presidential_plane.webp',
  plane: 'presidential_plane.webp',
  skyscraper: 'skyscraper.webp',
  stadiumbravo: 'stadium_bravo.webp',
  stadium: 'stadium_bravo.webp',
  themepark: 'theme_park.webp',
  tower: 'tower.webp',
  villa: 'villa.webp',
  yacht: 'yacht.webp',
};

export function r6MapImage(name?: string | null): string | null {
  if (!name) return null;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const file = MAP_FILES[key];
  return file ? `${MAP_CDN}/${file}` : null;
}

// Couleurs de side R6 : attaque orange, défense bleu.
export const R6_SIDE_CLASS: Record<string, string> = {
  atk: 'text-orange-400',
  def: 'text-sky-400',
};
