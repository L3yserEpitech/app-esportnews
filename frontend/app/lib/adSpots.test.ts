import { describe, expect, it } from 'vitest';
import { AD_SPOTS, parseFormat, resolveAdSpot, type RemoteAdSpots } from './adSpots';
import type { Advertisement } from '../types';

const legacy = (position: number, overrides: Partial<Advertisement> = {}): Advertisement => ({
  id: position,
  created_at: '2026-01-01T00:00:00Z',
  title: `Bannière ${position}`,
  position,
  type: 'image',
  url: `https://cdn.example/ads/${position}.png`,
  redirect_link: `https://partner.example/${position}`,
  ...overrides,
});

const creative = {
  media_url: 'https://cdn.example/custom.png',
  media_type: 'image' as const,
  redirect_link: 'https://partner.example/custom',
  title: 'Partenaire',
};

describe('parseFormat', () => {
  it('reads LxH', () => {
    expect(parseFormat('300x400')).toEqual({ width: 300, height: 400 });
    expect(parseFormat(' 728x90 ')).toEqual({ width: 728, height: 90 });
  });

  it('rejects anything else', () => {
    for (const value of ['', 'auto', '300', '300x', 'x250', '300X250', '300x250px', null, undefined]) {
      expect(parseFormat(value)).toBeNull();
    }
  });
});

describe('resolveAdSpot without /api/ad-spots', () => {
  it('serves AdSense on a spot that has no legacy banner', () => {
    expect(resolveAdSpot('sidebar-2', null, [legacy(1), legacy(3)])).toEqual({
      mode: 'adsense',
      slot: AD_SPOTS['sidebar-2'].adsenseSlot,
      size: { width: 300, height: 250 },
    });
  });

  it('keeps a legacy banner on its position in the right column', () => {
    const spot = resolveAdSpot('sidebar-3', null, [legacy(1), legacy(3)]);
    expect(spot).toMatchObject({
      mode: 'custom',
      width: 300,
      height: 400,
      creative: { media_url: 'https://cdn.example/ads/3.png', redirect_link: 'https://partner.example/3', media_type: 'image' },
    });
  });

  it('ignores a legacy banner that cannot be shown', () => {
    expect(resolveAdSpot('sidebar-1', null, [legacy(1, { url: null })]).mode).toBe('adsense');
    expect(resolveAdSpot('sidebar-1', null, [legacy(1, { redirect_link: '' })]).mode).toBe('adsense');
  });

  it('never maps legacy banners outside the right column', () => {
    expect(resolveAdSpot('article-bottom', null, [legacy(1)])).toEqual({
      mode: 'adsense',
      slot: AD_SPOTS['article-bottom'].adsenseSlot,
      size: null,
    });
    expect(resolveAdSpot('mobile-1', null, [legacy(1)]).mode).toBe('adsense');
  });
});

describe('resolveAdSpot with /api/ad-spots', () => {
  it('serves AdSense with the default slot on a spot the back-office does not know', () => {
    expect(resolveAdSpot('mobile-1', {}, [])).toEqual({ mode: 'adsense', slot: AD_SPOTS['mobile-1'].adsenseSlot, size: null });
  });

  it('no longer reads the legacy banners once the endpoint answers', () => {
    expect(resolveAdSpot('sidebar-1', {}, [legacy(1)]).mode).toBe('adsense');
  });

  it('takes the slot set in the back-office, and its default when it is empty', () => {
    const remote: RemoteAdSpots = {
      'sidebar-1': { mode: 'adsense', format: '300x400', adsense_slot: '1234567890', creative: null },
      'sidebar-2': { mode: 'adsense', format: '300x400', adsense_slot: null, creative: null },
      'sidebar-3': { mode: 'adsense', format: '300x400', adsense_slot: '  ', creative: null },
    };
    expect(resolveAdSpot('sidebar-1', remote)).toMatchObject({ mode: 'adsense', slot: '1234567890' });
    expect(resolveAdSpot('sidebar-2', remote)).toMatchObject({ mode: 'adsense', slot: AD_SPOTS['sidebar-2'].adsenseSlot });
    expect(resolveAdSpot('sidebar-3', remote)).toMatchObject({ mode: 'adsense', slot: AD_SPOTS['sidebar-3'].adsenseSlot });
  });

  it('shows the custom creative in the box of its format', () => {
    const remote: RemoteAdSpots = { 'article-bottom': { mode: 'custom', format: '970x250', adsense_slot: null, creative } };
    expect(resolveAdSpot('article-bottom', remote)).toEqual({ mode: 'custom', creative, width: 970, height: 250 });
  });

  it('falls back on the default box when the format is unreadable', () => {
    const remote: RemoteAdSpots = { 'sidebar-1': { mode: 'custom', format: 'large', creative } };
    expect(resolveAdSpot('sidebar-1', remote)).toMatchObject({ mode: 'custom', width: 300, height: 400 });
  });

  it('falls back on AdSense when a custom spot has no usable creative', () => {
    const remote: RemoteAdSpots = {
      'sidebar-1': { mode: 'custom', format: '300x400', adsense_slot: '1234567890', creative: null },
      'sidebar-2': { mode: 'custom', format: '300x400', creative: { ...creative, redirect_link: '' } },
    };
    expect(resolveAdSpot('sidebar-1', remote)).toMatchObject({ mode: 'adsense', slot: '1234567890' });
    expect(resolveAdSpot('sidebar-2', remote)).toMatchObject({ mode: 'adsense', slot: AD_SPOTS['sidebar-2'].adsenseSlot });
  });

  it('renders nothing on a spot turned off', () => {
    expect(resolveAdSpot('sidebar-2', { 'sidebar-2': { mode: 'off' } })).toEqual({ mode: 'off' });
  });

  it('treats a video creative as a video and anything else as an image', () => {
    const video: RemoteAdSpots = { 'sidebar-1': { mode: 'custom', creative: { ...creative, media_type: 'video' } } };
    const unknown = { 'sidebar-1': { mode: 'custom', creative: { ...creative, media_type: 'gif' } } } as unknown as RemoteAdSpots;
    expect(resolveAdSpot('sidebar-1', video)).toMatchObject({ creative: { media_type: 'video' } });
    expect(resolveAdSpot('sidebar-1', unknown)).toMatchObject({ creative: { media_type: 'image' } });
  });
});
