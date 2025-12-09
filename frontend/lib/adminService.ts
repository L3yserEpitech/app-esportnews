import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface Article {
  id: number;
  created_at: string;
  slug: string;
  tags: string[];
  title: string;
  views: number;
  author: string;
  content: string;
  category: string;
  subtitle?: string;
  description?: string;
  content_black?: string;
  content_white?: string;
  article_content?: string;
  featuredImage?: string;
  videoUrl?: string;
  videoType?: string;
  credit?: string;
  read_time?: number;
}

export interface CreateArticleInput {
  title: string;
  article_content: string;
  author?: string;
  subtitle?: string;
  category?: string;
  tags?: string[];
  description?: string;
  featuredImage?: string;
  videoUrl?: string;
  videoType?: string;
  credit?: string;
}

export interface UpdateArticleInput {
  title?: string;
  article_content?: string;
  author?: string;
  subtitle?: string;
  category?: string;
  tags?: string[];
  description?: string;
  featuredImage?: string;
  videoUrl?: string;
  videoType?: string;
  credit?: string;
}

class AdminService {
  private getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  // Articles
  async getAllArticles(): Promise<Article[]> {
    const response = await axios.get(`${API_URL}/admin/articles`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getArticleById(id: number): Promise<Article> {
    const response = await axios.get(`${API_URL}/admin/articles/${id}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async createArticle(input: CreateArticleInput): Promise<Article> {
    const response = await axios.post(`${API_URL}/admin/articles`, input, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async updateArticle(id: number, input: UpdateArticleInput): Promise<Article> {
    const response = await axios.put(`${API_URL}/admin/articles/${id}`, input, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async deleteArticle(id: number): Promise<void> {
    await axios.delete(`${API_URL}/admin/articles/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  async uploadCoverMedia(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_URL}/admin/articles/upload-cover`, formData, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadContentImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_URL}/admin/articles/upload-content`, formData, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Stats
  async getArticleStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    topArticles: Article[];
  }> {
    const articles = await this.getAllArticles();
    const total = articles.length;
    const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
    const avgViews = total > 0 ? Math.round(totalViews / total) : 0;
    const topArticles = articles
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);

    return { total, totalViews, avgViews, topArticles };
  }
}

export const adminService = new AdminService();
