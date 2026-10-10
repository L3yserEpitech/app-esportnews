import sanitizeHtml from 'sanitize-html';

// Article bodies are authored in the back-office and stored as raw HTML. They
// are sanitized here, on the server, so the text ships in the initial HTML
// (crawlers never ran the client-side DOMPurify pass that used to do this).
// sanitize-html parses with htmlparser2 — no DOM, no jsdom — which is what
// lets it run inside a Vercel function, where the previous jsdom-based attempt
// failed to resolve and 500'd every article page.
//
// Rules mirror the former DOMPurify config: `style`, `link` and `script`
// dropped with their content, inline `style` attributes dropped, tweet
// placeholders (`data-tweet-id`) preserved for react-tweet.
const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  'img', 'picture', 'video', 'audio', 'source', 'track',
  'del', 'ins', 'details', 'summary',
];

const GLOBAL_ATTRS = ['class', 'id', 'title', 'lang', 'dir', 'width', 'height', 'align', 'data-tweet-id'];

export function sanitizeArticle(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': GLOBAL_ATTRS,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'srcset', 'sizes', 'alt', 'loading', 'decoding'],
      video: ['src', 'poster', 'controls', 'loop', 'muted', 'autoplay', 'playsinline', 'preload'],
      audio: ['src', 'controls', 'loop', 'muted', 'autoplay', 'preload'],
      source: ['src', 'srcset', 'type', 'media'],
      track: ['src', 'kind', 'srclang', 'label'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
      ol: ['start', 'type', 'reversed'],
      blockquote: ['cite'],
      q: ['cite'],
      time: ['datetime'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    // Inline base64 images do exist in older articles.
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: true,
    // Tags not in the list are removed but their text kept, except these,
    // whose content must vanish with them.
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'template'],
  });
}
