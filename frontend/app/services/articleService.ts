import { NewsItem } from '../types';

interface ArticleApiResponse {
  id: number;
  created_at: number;
  article: {
    slug: string;
    tags: string[];
    title: string;
    views: number;
    author: string;
    status: string;
    content: string;
    category: string;
    readTime: number;
    subtitle: string;
    description: string;
    content_black: string;
    content_white: string;
    featuredImage: string;
  };
  slug: string;
}

class ArticleService {
  private baseUrl = 'https://x8ki-letl-twmt.n7.xano.io/api:ORFNTr45';

  async getAllArticles(): Promise<NewsItem[]> {
    try {
      const response = await fetch(`${this.baseUrl}/article_all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch articles: ${response.status}`);
      }

      const data: ArticleApiResponse[] = await response.json();

      // Transformer les données API vers le format NewsItem
      return data.map((item) => ({
        id: item.id,
        slug: item.article.slug,
        title: item.article.title,
        subtitle: item.article.subtitle,
        description: item.article.description,
        author: item.article.author,
        created_at: new Date(item.created_at).toISOString(),
        readTime: item.article.readTime,
        featuredImage: item.article.featuredImage,
        category: item.article.category,
        tags: item.article.tags,
        views: item.article.views,
        status: item.article.status as 'publié' | 'brouillon' | 'archivé'
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
}

export const articleService = new ArticleService();