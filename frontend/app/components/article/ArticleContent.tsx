'use client';

import { Component, useMemo } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Tweet } from 'react-tweet';
import styles from './ArticleContent.module.css';

class TweetErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('[TweetErrorBoundary] Tweet render failed:', error.message);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface ArticleContentProps {
  // Already sanitized by the server page (lib/sanitizeArticle.ts); never
  // pass raw back-office HTML here.
  content: string;
  isDarkMode?: boolean;
}

type Segment = { type: 'html'; html: string } | { type: 'tweet'; id: string };

function parseSegments(html: string): Segment[] {
  if (!html || typeof html !== 'string') return [{ type: 'html', html: html ?? '' }];
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

// Server-rendered: the text is in the initial HTML, which is the whole point
// (crawlers read it). Only the tweets hydrate on the client.
function HtmlBlock({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ArticleContent({ content, isDarkMode = true }: ArticleContentProps) {
  const segments = useMemo(() => parseSegments(content), [content]);
  const hasTweets = segments.some(s => s.type === 'tweet');

  if (!hasTweets) {
    return (
      <article
        className={styles.articleContent}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <article
      className={styles.articleContent}
    >
      {segments.map((segment, i) => {
        if (segment.type === 'tweet') {
          return (
            <TweetErrorBoundary key={segment.id} fallback={null}>
              <figure
                className={styles.tweetEmbed}
                role="article"
                aria-label="Tweet intégré"
                data-theme={isDarkMode ? 'dark' : 'light'}
              >
                {/* `apiUrl` is used verbatim as the fetch URL — react-tweet does
                    NOT append the id — so it has to carry the id itself. */}
                <Tweet
                  apiUrl={`/api/tweet/${segment.id}`}
                  id={segment.id}
                  fallback={null}
                  components={{ TweetNotFound: () => <></> }}
                />
              </figure>
            </TweetErrorBoundary>
          );
        }
        return <HtmlBlock key={i} html={segment.html} />;
      })}
    </article>
  );
}
