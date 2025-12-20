import apiClient from './apiClient';
import type { Article, NewsItem } from '@/types';

export interface ArticleQueryParams {
  limit?: number;
  offset?: number;
  category?: string;
}

class ArticleService {
  /**
   * Récupérer tous les articles
   */
  async getAllArticles(params?: ArticleQueryParams): Promise<NewsItem[]> {
    try {
      const response = await apiClient.get<NewsItem[]>('/api/articles', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching articles:', error);
      return [];
    }
  }

  /**
   * Récupérer un article par son slug
   */
  async getArticleBySlug(slug: string): Promise<Article | null> {
    try {
      const response = await apiClient.get<Article>(`/api/articles/${slug}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching article:', error);
      return null;
    }
  }

  /**
   * Récupérer les articles par catégorie
   */
  async getArticlesByCategory(
    category: string,
    params?: Omit<ArticleQueryParams, 'category'>
  ): Promise<NewsItem[]> {
    try {
      const response = await apiClient.get<NewsItem[]>('/api/articles', {
        params: { ...params, category },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching articles by category:', error);
      return [];
    }
  }
}

export const articleService = new ArticleService();
