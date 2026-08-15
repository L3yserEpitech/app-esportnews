// Liquipedia sends nationalities as full English country names ("United
// States", "Czech Republic"). Maps them to ISO 3166-1 alpha-2 codes for
// flag-icons. Covers every esports-relevant country; unknown → null (the
// consumer falls back to initials).
const COUNTRY_CODES: Record<string, string> = {
  afghanistan: 'af', albania: 'al', algeria: 'dz', argentina: 'ar', armenia: 'am',
  australia: 'au', austria: 'at', azerbaijan: 'az', bahrain: 'bh', bangladesh: 'bd',
  belarus: 'by', belgium: 'be', bolivia: 'bo', 'bosnia and herzegovina': 'ba',
  brazil: 'br', bulgaria: 'bg', cambodia: 'kh', canada: 'ca', chile: 'cl',
  china: 'cn', colombia: 'co', 'costa rica': 'cr', croatia: 'hr', cuba: 'cu',
  cyprus: 'cy', 'czech republic': 'cz', czechia: 'cz', denmark: 'dk',
  'dominican republic': 'do', ecuador: 'ec', egypt: 'eg', 'el salvador': 'sv',
  estonia: 'ee', finland: 'fi', france: 'fr', georgia: 'ge', germany: 'de',
  greece: 'gr', guatemala: 'gt', honduras: 'hn', 'hong kong': 'hk', hungary: 'hu',
  iceland: 'is', india: 'in', indonesia: 'id', iran: 'ir', iraq: 'iq',
  ireland: 'ie', israel: 'il', italy: 'it', japan: 'jp', jordan: 'jo',
  kazakhstan: 'kz', kenya: 'ke', kosovo: 'xk', kuwait: 'kw', kyrgyzstan: 'kg',
  laos: 'la', latvia: 'lv', lebanon: 'lb', lithuania: 'lt', luxembourg: 'lu',
  macau: 'mo', malaysia: 'my', malta: 'mt', mexico: 'mx', moldova: 'md',
  monaco: 'mc', mongolia: 'mn', montenegro: 'me', morocco: 'ma', myanmar: 'mm',
  nepal: 'np', netherlands: 'nl', 'new zealand': 'nz', nicaragua: 'ni',
  'north macedonia': 'mk', norway: 'no', oman: 'om', pakistan: 'pk',
  palestine: 'ps', panama: 'pa', paraguay: 'py', peru: 'pe', philippines: 'ph',
  poland: 'pl', portugal: 'pt', 'puerto rico': 'pr', qatar: 'qa', romania: 'ro',
  russia: 'ru', 'saudi arabia': 'sa', serbia: 'rs', singapore: 'sg',
  slovakia: 'sk', slovenia: 'si', 'south africa': 'za', 'south korea': 'kr',
  korea: 'kr', spain: 'es', 'sri lanka': 'lk', sweden: 'se', switzerland: 'ch',
  syria: 'sy', taiwan: 'tw', tajikistan: 'tj', thailand: 'th', tunisia: 'tn',
  turkey: 'tr', turkmenistan: 'tm', ukraine: 'ua', 'united arab emirates': 'ae',
  'united kingdom': 'gb', england: 'gb-eng', scotland: 'gb-sct', wales: 'gb-wls',
  'northern ireland': 'gb-nir', 'united states': 'us', usa: 'us', uruguay: 'uy',
  uzbekistan: 'uz', venezuela: 've', vietnam: 'vn', yemen: 'ye',
};

/** ISO alpha-2 code (flag-icons compatible) for a country name, or null. */
export function countryCode(country: string | undefined | null): string | null {
  if (!country) return null;
  return COUNTRY_CODES[country.trim().toLowerCase()] ?? null;
}
