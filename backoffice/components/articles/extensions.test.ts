import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { articleExtensions, countWords, extractTweetId, readingMinutes } from './extensions';

// The site renders the saved HTML as is: what each node serializes to must stay
// what frontend/components/admin/TiptapEditor.tsx produces. These checks read
// the output spec of the schema, which needs no DOM.
const schema = getSchema(articleExtensions('…'));

type Spec = [string, Record<string, unknown>, ...unknown[]];

function nodeSpec(type: string, attrs: Record<string, unknown>): Spec {
  const nodeType = schema.nodes[type];
  return nodeType.spec.toDOM!(nodeType.create(attrs)) as unknown as Spec;
}

function markSpec(type: string, attrs: Record<string, unknown>): Spec {
  const markType = schema.marks[type];
  return markType.spec.toDOM!(markType.create(attrs), true) as unknown as Spec;
}

describe('article editor schema', () => {
  it('has the nodes and marks of the site editor, each once', () => {
    for (const node of ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'image', 'customVideo', 'twitterEmbed', 'hardBreak']) {
      expect(schema.nodes[node], node).toBeDefined();
    }
    for (const mark of ['bold', 'italic', 'link', 'underline', 'strike']) {
      expect(schema.marks[mark], mark).toBeDefined();
    }
  });

  it('writes links the way stored articles carry them', () => {
    const [tag, attrs] = markSpec('link', { href: 'https://www.fifa.gg/' });
    expect(tag).toBe('a');
    expect(attrs).toMatchObject({
      href: 'https://www.fifa.gg/',
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
      class: 'text-[#F22E62] underline',
    });
  });

  it('writes images with the classes the article page expects', () => {
    const [tag, attrs] = nodeSpec('image', { src: 'https://cdn.example/a.jpg' });
    expect(tag).toBe('img');
    expect(attrs).toMatchObject({ src: 'https://cdn.example/a.jpg', class: 'max-w-full h-auto rounded-lg my-4' });
  });

  it('writes a video with its four options and the same classes', () => {
    const [tag, attrs] = nodeSpec('customVideo', { src: 'https://cdn.example/v.mp4', muted: true, autoplay: false, loop: true, controls: true });
    expect(tag).toBe('video');
    expect(attrs).toEqual({
      src: 'https://cdn.example/v.mp4',
      muted: true,
      autoplay: false,
      loop: true,
      controls: true,
      class: 'max-w-full h-auto rounded-lg my-4',
    });
  });

  it('writes a tweet as the placeholder the site hydrates', () => {
    expect(nodeSpec('twitterEmbed', { tweetId: '1234567890123456789' })).toEqual([
      'div',
      { 'data-tweet-id': '1234567890123456789', class: 'twitter-embed-placeholder' },
    ]);
  });

  it('keeps the alignment of a paragraph or a heading, and writes none by default', () => {
    expect(nodeSpec('paragraph', { textAlign: 'center' })[1]).toMatchObject({ style: 'text-align: center' });
    expect(nodeSpec('heading', { level: 2, textAlign: 'right' })[1]).toMatchObject({ style: 'text-align: right' });
    expect(nodeSpec('paragraph', {})[1] ?? {}).not.toHaveProperty('style');
  });

  it('reads the alignment from the inline style only when it is a known one', () => {
    const spec = schema.nodes.paragraph.spec.parseDOM?.[0];
    const read = (textAlign: string) => {
      const attrs = spec?.getAttrs?.({ style: { textAlign }, getAttribute: () => null } as unknown as HTMLElement);
      // An attribute the rule leaves out falls back on its default, null.
      return (attrs && typeof attrs === 'object' ? (attrs as Record<string, unknown>).textAlign : undefined) ?? null;
    };
    expect(read('justify')).toBe('justify');
    expect(read('start')).toBeNull();
    expect(read('')).toBeNull();
  });
});

describe('editor helpers', () => {
  it('extracts a tweet id from a link or a bare number', () => {
    expect(extractTweetId('https://x.com/EsportNews/status/1234567890123456789?s=20')).toBe('1234567890123456789');
    expect(extractTweetId('https://twitter.com/user/status/1234567890123')).toBe('1234567890123');
    expect(extractTweetId(' 1234567890123 ')).toBe('1234567890123');
    expect(extractTweetId('https://x.com/EsportNews')).toBeNull();
    expect(extractTweetId('12345')).toBeNull();
  });

  it('counts words and reading time like the article page (200 words a minute)', () => {
    expect(countWords('')).toBe(0);
    expect(countWords("  L'Année 11   touche à sa fin\n\navec une mise à jour ")).toBe(11);
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(201)).toBe(2);
    expect(readingMinutes(612)).toBe(4);
  });
});
