import { describe, expect, it } from 'vitest';
import { authorDisplayName, authorQueryValue, findAuthor, findAuthorBySlug, normalizeByline } from './authors';

describe('authors registry', () => {
  it('maps every production spelling of a byline to one full name', () => {
    expect(findAuthor('Samuel C')?.name).toBe('Samuel Cohen');
    expect(findAuthor('Samuel Cohen')?.name).toBe('Samuel Cohen');
    expect(findAuthor('Kenan Altarac ')?.slug).toBe('kenan-altarac');
    expect(findAuthor(' Mickael Lemoult')?.slug).toBe('mickael-lemoult');
    expect(findAuthor('Haykel EL Abed')?.slug).toBe('haykel-el-abed');
    expect(findAuthor('Thomas Noel')?.slug).toBe('thomas-noel');
  });

  it('keeps unknown bylines readable without inventing a page', () => {
    expect(findAuthor('Rédaction')).toBeNull();
    expect(authorDisplayName('  Rédaction  ')).toBe('Rédaction');
    expect(authorDisplayName(null)).toBe('');
  });

  it('exposes every alias to the backend filter', () => {
    const author = findAuthorBySlug('samuel-cohen')!;
    expect(authorQueryValue(author)).toBe('Samuel Cohen,Samuel C');
  });

  it('normalizes case, accents and whitespace', () => {
    expect(normalizeByline('  Thomas   NOËL ')).toBe('thomas noel');
  });
});
