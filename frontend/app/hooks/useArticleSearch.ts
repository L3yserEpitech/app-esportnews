'use client';

import { useEffect, useRef, useState } from 'react';
import { articleService } from '../services/articleService';
import type { NewsItem } from '../types';

interface UseArticleSearchOptions {
  category?: string;
  excludeNews?: boolean;
  limit?: number;
  /** Milliseconds to wait after the last keystroke before firing. */
  debounceMs?: number;
  /** When false, the hook short-circuits. Use this to avoid pre-fetching
   *  before the user has actually opened the search modal. */
  enabled?: boolean;
}

interface UseArticleSearchResult {
  results: NewsItem[];
  isSearching: boolean;
  /** True once the first non-empty query has been issued. Useful for
   *  rendering "Tape pour rechercher…" copy until then. */
  hasSearched: boolean;
}

/**
 * Debounced full-text search backed by the Postgres FTS endpoint.
 *
 * - Each keystroke schedules a single backend call after `debounceMs` of
 *   silence. Earlier in-flight requests are aborted via AbortController so
 *   stale responses can never overwrite a newer one.
 * - Empty queries clear results immediately without hitting the backend.
 * - Filter options (category, excludeNews) are part of the dependency list
 *   so flipping them re-runs the search.
 */
export function useArticleSearch(
  query: string,
  {
    category,
    excludeNews,
    limit = 50,
    debounceMs = 220,
    enabled = true,
  }: UseArticleSearchOptions = {},
): UseArticleSearchResult {
  const [results, setResults] = useState<NewsItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (!enabled || !trimmed) {
      setResults([]);
      setIsSearching(false);
      abortRef.current?.abort();
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const found = await articleService.searchArticles(trimmed, {
        category,
        excludeNews,
        limit,
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        setResults(found);
        setHasSearched(true);
        setIsSearching(false);
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, category, excludeNews, limit, debounceMs, enabled]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  return { results, isSearching, hasSearched };
}
