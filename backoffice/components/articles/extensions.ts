import { Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';

// The body an article is saved with is the HTML of this editor, and the public
// site renders that HTML as is. Every extension below therefore mirrors
// frontend/components/admin/TiptapEditor.tsx (the editor of the site's /admin):
// same nodes, same attributes, same classes in the output. Change both or none.

// Verbatim from the site's editor, attribute rendering included.
export const CustomVideo = Node.create({
  name: 'customVideo',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      muted: { default: false },
      autoplay: { default: false },
      loop: { default: false },
      controls: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', { ...HTMLAttributes, class: 'max-w-full h-auto rounded-lg my-4' }];
  },
});

export const TwitterEmbed = Node.create({
  name: 'twitterEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return { tweetId: { default: null } };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-tweet-id]',
        getAttrs: (dom: HTMLElement) => ({ tweetId: dom.getAttribute('data-tweet-id') }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-tweet-id': HTMLAttributes.tweetId, class: 'twitter-embed-placeholder' }];
  },
});

const ALIGNMENTS = ['left', 'center', 'right', 'justify'];

// Same attribute as @tiptap/extension-text-align (not installed here), so the
// alignment a paragraph was given in the site's editor survives a save.
export const TextAlign = Extension.create({
  name: 'textAlign',

  addGlobalAttributes() {
    return [
      {
        types: ['heading', 'paragraph'],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const alignment = element.style.textAlign;
              return ALIGNMENTS.includes(alignment) ? alignment : null;
            },
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {},
          },
        },
      },
    ];
  },
});

export function articleExtensions(placeholder: string) {
  return [
    // StarterKit 3 ships its own Link: the configured one below must be the only one.
    StarterKit.configure({ link: false }),
    Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-[#F22E62] underline' } }),
    Image.configure({ HTMLAttributes: { class: 'max-w-full h-auto rounded-lg my-4' } }),
    CustomVideo,
    TwitterEmbed,
    TextAlign,
    Placeholder.configure({ placeholder }),
  ];
}

// A tweet URL (twitter.com or x.com) or a bare numeric id.
export function extractTweetId(input: string): string | null {
  const value = input.trim();
  if (/^\d{10,20}$/.test(value)) return value;
  const match = value.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d{10,20})/);
  return match ? match[1] : null;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// 200 words a minute, as the article page of the site counts it.
export function readingMinutes(words: number): number {
  return words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
}
