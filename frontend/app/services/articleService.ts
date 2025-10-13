import { NewsItem, Article, SupabaseArticle } from '../types';

class ArticleService {
  private baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

  async getAllArticles(): Promise<NewsItem[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/articles`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch articles: ${response.status}`);
      }

      const data: SupabaseArticle[] = await response.json();

      // Transformer les données API vers le format NewsItem
      return data.map((item: SupabaseArticle) => ({
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
        tags: item.tags || [],
        views: item.views || 0,
      }));

    } catch (error) {
      console.error('Error fetching articles:', error);
      return [];
    }
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

  // Méthode pour incrémenter les vues d'un article
  async incrementViews(slug: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/articles/${slug}/views`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to increment views: ${response.status}`);
      }
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  }
}

export const articleService = new ArticleService();