'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import styles from './ArticleContent.module.css';

// Charge le script officiel X (widgets.js) une seule fois pour toute la page.
// Le rendu se fait dans le navigateur du visiteur (son IP, via l'iframe X) :
// ça contourne à la fois le blocage IP datacenter du endpoint syndication ET
// le CORS — contrairement à un fetch serveur (api/tweet) qui échoue en prod.
let twitterWidgetsPromise: Promise<TwttrApi | null> | null = null;

interface TwttrApi {
  widgets: { load: (el?: HTMLElement) => Promise<void> };
}

function loadTwitterWidgets(): Promise<TwttrApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const existingApi = (window as unknown as { twttr?: TwttrApi }).twttr;
  if (existingApi?.widgets) return Promise.resolve(existingApi);
  if (twitterWidgetsPromise) return twitterWidgetsPromise;

  twitterWidgetsPromise = new Promise((resolve) => {
    const ready = () => resolve((window as unknown as { twttr?: TwttrApi }).twttr ?? null);
    const existingScript = document.getElementById('twitter-wjs') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', ready, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'twitter-wjs';
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    document.body.appendChild(script);
  });

  return twitterWidgetsPromise;
}

// `id` est garanti numérique (regex \d{10,20} dans parseSegments) → pas
// d'injection possible dans le innerHTML ci-dessous.
function TwitterEmbed({ id, isDark }: { id: string; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    setLoaded(false);
    el.innerHTML =
      `<blockquote class="twitter-tweet" data-theme="${isDark ? 'dark' : 'light'}" data-dnt="true">` +
      `<a href="https://twitter.com/i/status/${id}">Voir le tweet sur X</a></blockquote>`;

    loadTwitterWidgets().then((twttr) => {
      if (cancelled || !twttr?.widgets || !ref.current) return;
      twttr.widgets.load(ref.current).then(() => {
        if (!cancelled) setLoaded(true);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [id, isDark]);

  return <div ref={ref} className={styles.tweetEmbed} data-loaded={loaded} />;
}

interface ArticleContentProps {
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

// Rend un bloc HTML sanitizé via ref (contenu déjà traité par DOMPurify)
function HtmlBlock({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
  }, [html]);
  return <div ref={ref} />;
}

export default function ArticleContent({ content, isDarkMode = true }: ArticleContentProps) {
  // DOMPurify requires a window — sanitize on the client only to avoid SSR
  // crashes (jsdom not bundled) and to prevent hydration mismatches. The
  // surrounding article shell (cover, h1, schema) is server-rendered.
  const [sanitized, setSanitized] = useState('');

  useEffect(() => {
    setSanitized(
      DOMPurify.sanitize(content, {
        FORBID_TAGS: ['style', 'link', 'script'],
        FORBID_ATTR: ['style'],
        ADD_ATTR: ['class', 'href', 'target', 'rel', 'title', 'alt', 'data-tweet-id'],
        USE_PROFILES: { html: true },
      }),
    );
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
          return <TwitterEmbed key={`tweet-${segment.id}-${i}`} id={segment.id} isDark={isDarkMode} />;
        }
        return <HtmlBlock key={i} html={segment.html} />;
      })}
    </article>
  );
}
