// Author pages of the public site (frontend/app/lib/authors.ts is the registry
// of record). The back-office only needs to know which team member has one, to
// link to it: keep the slugs in step when a journalist joins.
const AUTHOR_SLUGS: Record<string, string> = {
  'samuel cohen': 'samuel-cohen',
  'samuel c': 'samuel-cohen',
  'kenan altarac': 'kenan-altarac',
  'nathan guillemant': 'nathan-guillemant',
  'mickael lemoult': 'mickael-lemoult',
  'alexandre foumangoye': 'alexandre-foumangoye',
  'guillaume vial': 'guillaume-vial',
  'haykel el abed': 'haykel-el-abed',
  'jawed aichouche': 'jawed-aichouche',
  'sami zeroual': 'sami-zeroual',
  'thomas noel': 'thomas-noel',
  'kenan paris': 'kenan-paris',
  'shawn a': 'shawn-a',
};

export function normalizeByline(raw: string | null | undefined): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function authorPath(name: string | null | undefined): string | null {
  const slug = AUTHOR_SLUGS[normalizeByline(name)];
  return slug ? `/auteurs/${slug}` : null;
}
