import { NewsItem, Article, SupabaseArticle } from '../types';

class ArticleService {
  private baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  private lastTotalCount: number = 0; // Cache for X-Total-Count header

  async getAllArticles(options?: { limit?: number; offset?: number; category?: string; excludeNews?: boolean }): Promise<NewsItem[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.category) params.append('category', options.category);
      if (options?.excludeNews) params.append('excludeNews', 'true');

      const url = `${this.baseUrl}/api/articles${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch articles: ${response.status}`);
      }

      // Read X-Total-Count header for pagination
      const totalCountHeader = response.headers.get('X-Total-Count');
      if (totalCountHeader) {
        this.lastTotalCount = parseInt(totalCountHeader, 10);
      }

      const data: SupabaseArticle[] = await response.json();

      console.log('[ArticleService] Raw API response:', {
        url,
        dataLength: data?.length || 0,
        isArray: Array.isArray(data),
        totalCountHeader: totalCountHeader,
        lastTotalCount: this.lastTotalCount,
      });

      // Transformer les données API vers le format NewsItem
      if (!data || !Array.isArray(data)) {
        console.warn('[ArticleService] Invalid data format:', data);
        return [];
      }

      const transformed = data.map((item: SupabaseArticle) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        author: item.author,
        created_at: item.created_at,
        readTime: this.calculateReadTime(item.content), // Calculer le temps de lecture
        featuredImage: item.featuredImage,
        category: item.category,
        credit: item.credit,
        tags: item.tags || [],
        views: item.views || 0,
      }));

      console.log('[ArticleService] Transformed articles:', transformed.length);
      return transformed;

    } catch (error) {
      console.error('Error fetching articles:', error);
      return [];
    }
  }

  getLastTotalCount(): number {
    return this.lastTotalCount;
  }

  async getLatestArticle(): Promise<NewsItem | null> {
    try {
      const articles = await this.getAllArticles();
      // Le premier article de la liste est le plus récent
      return articles.length > 0 ? articles[0] : null;
    } catch (error) {
      console.error('Error fetching latest article:', error);
      return null;
    }
  }

  async getArticleBySlug(slug: string): Promise<Article | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/articles/${slug}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch article: ${response.status}`);
      }

      const data: SupabaseArticle = await response.json();

      // Transformer les données API vers le format Article
      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        subtitle: data.subtitle,
        description: data.description,
        author: data.author,
        created_at: data.created_at,
        readTime: this.calculateReadTime(data.content),
        featuredImage: data.featuredImage,
        category: data.category,
        credit: data.credit,
        tags: data.tags || [],
        views: data.views || 0,
        content: data.content,
        content_black: data.content_black,
        content_white: data.content_white,
      };

    } catch (error) {
      console.error('Error fetching article by slug:', error);
      return null;
    }
  }

  /**
   * Full-text search against the entire articles table via the backend
   * `/api/articles/search` endpoint. Server-side ranks results with
   * Postgres tsvector + pg_trgm fuzzy fallback (see migration 00013), so
   * this is the canonical search — it does NOT depend on whatever happens
   * to be loaded on the current page.
   *
   * Returns [] for blank queries so callers can short-circuit.
   */
  async searchArticles(
    query: string,
    options?: { category?: string; excludeNews?: boolean; limit?: number; signal?: AbortSignal },
  ): Promise<NewsItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const params = new URLSearchParams();
    params.append('q', trimmed);
    if (options?.category) params.append('category', options.category);
    if (options?.excludeNews) params.append('excludeNews', 'true');
    if (options?.limit) params.append('limit', String(options.limit));

    try {
      const res = await fetch(`${this.baseUrl}/api/articles/search?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: options?.signal,
      });
      if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`);
      }
      const data: SupabaseArticle[] = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        author: item.author,
        created_at: item.created_at,
        readTime: this.calculateReadTime(item.content),
        featuredImage: item.featuredImage,
        category: item.category,
        credit: item.credit,
        tags: item.tags || [],
        views: item.views || 0,
      }));
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return [];
      console.error('[ArticleService] search error:', error);
      return [];
    }
  }

  async getSimilarArticles(tags: string[], currentSlug: string, limit: number = 3): Promise<NewsItem[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/articles/${currentSlug}/similar?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch similar articles: ${response.status}`);
      }

      const data: SupabaseArticle[] = await response.json();

      // Transformer les données API vers le format NewsItem
      if (!data || !Array.isArray(data)) {
        return [];
      }

      return data.map((item: SupabaseArticle) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        author: item.author,
        created_at: item.created_at,
        readTime: this.calculateReadTime(item.content),
        featuredImage: item.featuredImage,
        category: item.category,
        credit: item.credit,
        tags: item.tags || [],
        views: item.views || 0,
      }));

    } catch (error) {
      console.error('Error fetching similar articles:', error);
      return [];
    }
  }

  // Méthode utilitaire pour calculer le temps de lecture
  private calculateReadTime(content: string): number {
    if (!content) return 0;
    
    // Supprimer les balises HTML et compter les mots
    const textContent = content.replace(/<[^>]*>/g, '');
    const wordCount = textContent.split(/\s+/).length;
    
    // Estimation : 200 mots par minute
    const wordsPerMinute = 200;
    const readTime = Math.ceil(wordCount / wordsPerMinute);
    
    return Math.max(1, readTime); // Minimum 1 minute
  }
}

export const articleService = new ArticleService();