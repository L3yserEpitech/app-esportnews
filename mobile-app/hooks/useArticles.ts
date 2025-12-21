import { useState, useEffect } from 'react';
import { articleService } from '@/services';
import type { NewsItem } from '@/types';

interface UseArticlesOptions {
  category?: string;
  limit?: number;
  offset?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseArticlesResult {
  articles: NewsItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export const useArticles = (options: UseArticlesOptions = {}): UseArticlesResult => {
  const {
    category,
    limit = 10,
    offset: initialOffset = 0,
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes default
  } = options;

  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(true);

  const fetchArticles = async (isRefetch: boolean = false) => {
    try {
      if (isRefetch) {
        setIsRefreshing(true);
        setOffset(0);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const params = {
        limit,
        offset: isRefetch ? 0 : offset,
        ...(category && { category }),
      };

      const data = await articleService.getAllArticles(params);

      if (isRefetch) {
        setArticles(data);
        setOffset(limit);
      } else {
        setArticles(prev => offset === 0 ? data : [...prev, ...data]);
      }

      setHasMore(data.length === limit);
    } catch (err) {
      console.error('Error fetching articles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      const params = {
        limit,
        offset,
        ...(category && { category }),
      };

      const data = await articleService.getAllArticles(params);

      setArticles(prev => [...prev, ...data]);
      setOffset(prev => prev + limit);
      setHasMore(data.length === limit);
    } catch (err) {
      console.error('Error loading more articles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more articles');
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    await fetchArticles(true);
  };

  // Initial fetch
  useEffect(() => {
    fetchArticles();
  }, [category]);

  // Auto-refresh (optional)
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchArticles(true);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, category]);

  return {
    articles,
    isLoading,
    isRefreshing,
    error,
    refetch,
    loadMore,
    hasMore,
  };
};
