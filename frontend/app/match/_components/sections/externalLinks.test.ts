import { describe, it, expect } from 'vitest';
import { buildExternalLinks } from './externalLinks';

describe('buildExternalLinks', () => {
  it('maps known providers to labels and keeps order', () => {
    const out = buildExternalLinks({ dotabuff: 'https://d', stratz: 'https://s', unknownx: 'https://u' });
    expect(out.map(l => l.label)).toEqual(['Dotabuff', 'STRATZ', 'unknownx']);
    expect(out[0].url).toBe('https://d');
  });
  it('returns [] for empty/undefined', () => {
    expect(buildExternalLinks(undefined)).toEqual([]);
    expect(buildExternalLinks({})).toEqual([]);
  });
});
