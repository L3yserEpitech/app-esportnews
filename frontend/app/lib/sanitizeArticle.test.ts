import { describe, expect, it } from 'vitest';
import { sanitizeArticle } from './sanitizeArticle';

describe('sanitizeArticle', () => {
  it('keeps editorial markup and tweet placeholders', () => {
    const out = sanitizeArticle(
      '<h2>Titre</h2><p class="lead"><strong>Gras</strong> et <em>italique</em></p>' +
        '<div data-tweet-id="1234567890123"></div>' +
        '<img src="https://images.esportnews.fr/a.png" alt="a" width="800">' +
        '<a href="https://liquipedia.net" target="_blank" rel="noopener">lien</a>' +
        '<video src="https://x/y.mp4" controls loop muted></video>',
    );
    expect(out).toContain('<h2>Titre</h2>');
    expect(out).toContain('<p class="lead"><strong>Gras</strong> et <em>italique</em></p>');
    expect(out).toContain('data-tweet-id="1234567890123"');
    expect(out).toContain('<img src="https://images.esportnews.fr/a.png" alt="a" width="800"');
    expect(out).toContain('target="_blank" rel="noopener"');
    expect(out).toContain('<video src="https://x/y.mp4" controls loop muted>');
  });

  it('drops style/script/link blocks with their content and inline styles', () => {
    const out = sanitizeArticle(
      '<style>.x{color:red}</style><script>alert(1)</script><link rel="stylesheet" href="x.css">' +
        '<p style="color:red" onclick="alert(1)">texte</p><iframe src="https://evil"></iframe>',
    );
    expect(out).toBe('<p>texte</p>');
  });

  it('allows inline base64 images but blocks javascript: links', () => {
    const out = sanitizeArticle('<img src="data:image/png;base64,AAAA"><a href="javascript:alert(1)">x</a>');
    expect(out).toContain('src="data:image/png;base64,AAAA"');
    expect(out).not.toContain('javascript:');
  });

  it('returns an empty string for missing content', () => {
    expect(sanitizeArticle(null)).toBe('');
    expect(sanitizeArticle(undefined)).toBe('');
  });
});
