import { describe, it, expect } from 'vitest';
import { isBlockedCrawler, BLOCKED_CRAWLERS } from './crawlers';

describe('isBlockedCrawler', () => {
  it('blocks the crawlers listed in robots.txt, whatever the case', () => {
    expect(isBlockedCrawler('Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)')).toBe(true);
    expect(isBlockedCrawler('meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)')).toBe(true);
    expect(isBlockedCrawler('Mozilla/5.0 (compatible; bytespider; spider-feedback@bytedance.com)')).toBe(true);
  });

  it('lets browsers, Googlebot and link-preview fetchers through', () => {
    expect(isBlockedCrawler('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36')).toBe(false);
    expect(isBlockedCrawler('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(false);
    expect(isBlockedCrawler('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(false);
    expect(isBlockedCrawler(null)).toBe(false);
  });

  it('keeps one list for robots.txt and the middleware', () => {
    expect(BLOCKED_CRAWLERS).toContain('Baiduspider');
    expect(BLOCKED_CRAWLERS).not.toContain('facebookexternalhit');
  });
});

describe('isBlockedCrawlerIp', () => {
  it('blocks the published Baiduspider range, whose renderer uses a browser user agent', async () => {
    const { isBlockedCrawlerIp } = await import('./crawlers');
    expect(isBlockedCrawlerIp('116.179.37.217')).toBe(true);
    expect(isBlockedCrawlerIp('116.179.47.255')).toBe(true);
    expect(isBlockedCrawlerIp('116.179.48.0')).toBe(false);
    expect(isBlockedCrawlerIp('8.8.8.8')).toBe(false);
    expect(isBlockedCrawlerIp(null)).toBe(false);
    expect(isBlockedCrawlerIp('2a01:cb00::1')).toBe(false);
  });
});
