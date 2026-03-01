'use client';

import { useMemo, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Tweet } from 'react-tweet';
import styles from './ArticleContent.module.css';

interface ArticleContentProps {
  content: string;
  isDarkMode?: boolean;
}

type Segment = { type: 'html'; html: string } | { type: 'tweet'; id: string };

function parseSegments(html: string): Segment[] {
  const pattern = /<div[^>]+data-tweet-id="(\d{10,20})"[^>]*>(?:[\s\S]*?<\/div>)?/gi;
  const matches = [...html.matchAll(pattern)];

  if (matches.length === 0) return [{ type: 'html', html }];

  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    const matchStart = match.index ?? 0;
    if (matchStart > lastIndex) {
      segments.push({ type: 'html', html: html.slice(lastIndex, matchStart) });
    }
    segments.push({ type: 'tweet', id: match[1] });
    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({ type: 'html', html: html.slice(lastIndex) });
  }

  return segments;
}

// Rend un bloc HTML sanitizé via ref (contenu déjà traité par DOMPurify)
function HtmlBlock({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
  }, [html]);
  return <div ref={ref} />;
}

export default function ArticleContent({ content, isDarkMode = true }: ArticleContentProps) {
  const sanitized = useMemo(() => {
    return DOMPurify.sanitize(content, {
      FORBID_TAGS: ['style', 'link', 'script'],
      FORBID_ATTR: ['style'],
      ADD_ATTR: ['class', 'href', 'target', 'rel', 'title', 'alt', 'data-tweet-id'],
      USE_PROFILES: { html: true },
    });
  }, [content]);

  const segments = useMemo(() => parseSegments(sanitized), [sanitized]);
  const hasTweets = segments.some(s => s.type === 'tweet');

  if (!hasTweets) {
    return (
      <article
        className={styles.articleContent}
        itemScope
        itemType="https://schema.org/Article"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  return (
    <article
      className={styles.articleContent}
      itemScope
      itemType="https://schema.org/Article"
    >
      {segments.map((segment, i) => {
        if (segment.type === 'tweet') {
          const tweetUrl = `https://x.com/i/web/status/${segment.id}`;
          return (
            <figure
              key={i}
              className={styles.tweetEmbed}
              role="article"
              aria-label="Tweet intégré"
              data-theme={isDarkMode ? 'dark' : 'light'}
            >
              <Tweet
                id={segment.id}
                fallback={
                  <a
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.tweetFallback}
                  >
                    Voir ce tweet sur X →
                  </a>
                }
              />
            </figure>
          );
        }
        return <HtmlBlock key={i} html={segment.html} />;
      })}
    </article>
  );
}
