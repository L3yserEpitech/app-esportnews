import { NewsItem, Article } from '../types';

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

  async getArticleBySlug(slug: string): Promise<Article | null> {
    try {
      const response = await fetch(`${this.baseUrl}/article_all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch article: ${response.status}`);
      }

      const data: ArticleApiResponse[] = await response.json();

      // Trouver l'article correspondant au slug
      const articleData = data.find((item) => item.article.slug === slug);

      if (!articleData) {
        return null;
      }

      // Transformer les données API vers le format Article
      return {
        id: articleData.id,
        slug: articleData.article.slug,
        title: articleData.article.title,
        subtitle: articleData.article.subtitle,
        description: articleData.article.description,
        author: articleData.article.author,
        created_at: new Date(articleData.created_at).toISOString(),
        readTime: articleData.article.readTime,
        featuredImage: articleData.article.featuredImage,
        category: articleData.article.category,
        tags: articleData.article.tags,
        views: articleData.article.views,
        status: articleData.article.status as 'publié' | 'brouillon' | 'archivé',
        content: articleData.article.content,
        content_black: articleData.article.content_black,
        content_white: articleData.article.content_white,
      };

    } catch (error) {
      console.error('Error fetching article by slug:', error);
      return null;
    }
  }

  async getSimilarArticles(tags: string[], currentSlug: string, limit: number = 3): Promise<NewsItem[]> {
    try {
      const allArticles = await this.getAllArticles();

      // Filtrer l'article courant et calculer un score de similarité
      const articlesWithScore = allArticles
        .filter(article => article.slug !== currentSlug)
        .map(article => {
          const commonTags = article.tags.filter(tag => tags.includes(tag));
          return {
            article,
            score: commonTags.length
          };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      return articlesWithScore.slice(0, limit).map(item => item.article);
    } catch (error) {
      console.error('Error fetching similar articles:', error);
      return [];
    }
  }
}

export const articleService = new ArticleService();