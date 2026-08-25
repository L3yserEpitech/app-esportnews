import DOMPurify from 'isomorphic-dompurify';

// Article bodies are sanitized on the SERVER so the markup ships in the HTML.
// Doing it in a client effect (as before) left the served <article> empty:
// crawlers, and the first paint, got the title and cover but not a word of the
// body. isomorphic-dompurify runs the very same DOMPurify rules under Node, so
// the output is byte-identical to what the browser used to produce — no
// hydration mismatch, and no change to what readers see.
const CONFIG = {
  FORBID_TAGS: ['style', 'link', 'script'],
  FORBID_ATTR: ['style'],
  ADD_ATTR: ['class', 'href', 'target', 'rel', 'title', 'alt', 'data-tweet-id'],
  USE_PROFILES: { html: true },
};

export function sanitizeArticleHtml(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, CONFIG);
}
