import { useState, useEffect, useCallback } from 'react';
import { articleService } from '@/services/articleService';
import { tournamentService } from '@/services/tournamentService';
import { NewsItem, PandaTournament } from '@/types';

interface HomeData {
  news: NewsItem[];
  tournaments: PandaTournament[];
  isLoading: boolean;
  error: string | null;
}

export const useHomeData = (gameAcronym?: string) => {
  const [data, setData] = useState<HomeData>({
    news: [],
    tournaments: [],
    isLoading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setData(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const [newsItems, tournamentItems] = await Promise.all([
        articleService.getAllArticles({ limit: 5 }),
        tournamentService.getTournaments({ game: gameAcronym, limit: 10 }),
      ]);

      setData({
        news: newsItems,
        tournaments: tournamentItems,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching home data:', err);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Impossible de charger les données.',
      }));
    }
  }, [gameAcronym]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refetch: fetchData };
};
