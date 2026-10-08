// Bylines are free text typed in the back-office, so one journalist shows up
// under several spellings ("Samuel C" / "Samuel Cohen", trailing spaces,
// "EL" vs "El"). This registry is the single place that maps every spelling
// to one full name and one author page. Names come from the real bylines in
// production; nothing here is invented, and an author missing from the list
// is still displayed (trimmed) — just without a page.

export interface Author {
  slug: string;
  name: string;
  // Every raw byline value that designates this person. Display matching
  // ignores case, whitespace and accents; the backend `?author=` filter only
  // ignores case and whitespace, so an accented spelling present in the table
  // must be listed here verbatim.
  aliases: string[];
}

export const AUTHORS: Author[] = [
  { slug: 'samuel-cohen', name: 'Samuel Cohen', aliases: ['Samuel C'] },
  { slug: 'kenan-altarac', name: 'Kenan Altarac', aliases: [] },
  { slug: 'nathan-guillemant', name: 'Nathan Guillemant', aliases: [] },
  { slug: 'mickael-lemoult', name: 'Mickael Lemoult', aliases: [] },
  { slug: 'alexandre-foumangoye', name: 'Alexandre Foumangoye', aliases: [] },
  { slug: 'guillaume-vial', name: 'Guillaume Vial', aliases: [] },
  { slug: 'haykel-el-abed', name: 'Haykel El Abed', aliases: [] },
  { slug: 'jawed-aichouche', name: 'Jawed Aichouche', aliases: [] },
  { slug: 'sami-zeroual', name: 'Sami Zeroual', aliases: [] },
  { slug: 'thomas-noel', name: 'Thomas Noël', aliases: [] },
  // Only the initial is known for this byline; the full surname has to come
  // from the editorial team before this entry can be completed.
  { slug: 'shawn-a', name: 'Shawn A', aliases: [] },
];

export function normalizeByline(raw: string | null | undefined): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const BY_ALIAS = new Map<string, Author>();
for (const author of AUTHORS) {
  BY_ALIAS.set(normalizeByline(author.name), author);
  for (const alias of author.aliases) BY_ALIAS.set(normalizeByline(alias), author);
}

export function findAuthor(raw: string | null | undefined): Author | null {
  return BY_ALIAS.get(normalizeByline(raw)) || null;
}

export function findAuthorBySlug(slug: string): Author | null {
  return AUTHORS.find((a) => a.slug === slug) || null;
}

// Display name for a byline: the registry's full name when known, otherwise
// the raw value cleaned of stray whitespace.
export function authorDisplayName(raw: string | null | undefined): string {
  const author = findAuthor(raw);
  if (author) return author.name;
  return (raw || '').replace(/\s+/g, ' ').trim();
}

export function authorHref(author: Author): string {
  return `/auteurs/${author.slug}`;
}

// Every spelling the backend must match for this author (`?author=` filter).
export function authorQueryValue(author: Author): string {
  return [author.name, ...author.aliases].join(',');
}
