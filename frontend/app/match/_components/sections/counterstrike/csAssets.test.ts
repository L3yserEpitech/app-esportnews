import { describe, it, expect } from 'vitest';
import { csMapImage } from './csAssets';

describe('csMapImage', () => {
  it('maps known names and falls back to de_<slug>', () => {
    expect(csMapImage('Mirage')).toContain('de_mirage.png');
    expect(csMapImage('Dust2')).toContain('de_dust2.png');
    expect(csMapImage('Office')).toContain('cs_office.png');
    expect(csMapImage(null)).toBeNull();
  });
});
