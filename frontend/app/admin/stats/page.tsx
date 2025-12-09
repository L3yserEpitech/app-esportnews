"use client";

import { useEffect, useState } from "react";
import { adminService, Article } from "@/lib/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = ["#F22E62", "#182859", "#00C49F", "#FFBB28", "#8884D8", "#FF8042"];

interface CategoryData {
  name: string;
  count: number;
  views: number;
}

export default function StatsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await adminService.getAllArticles();
      setArticles(data);
    } catch (error) {
      console.error("Error loading articles:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  // Top 10 articles par vues
  const topArticles = [...articles]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 10)
    .map((article) => ({
      name: article.title.length > 30 ? article.title.substring(0, 30) + "..." : article.title,
      vues: article.views || 0,
    }));

  // Articles par catégorie
  const categoryStats = articles.reduce((acc: any, article) => {
    const category = article.category || "Sans catégorie";
    if (!acc[category]) {
      acc[category] = { name: category, count: 0, views: 0 };
    }
    acc[category].count++;
    acc[category].views += article.views || 0;
    return acc;
  }, {});

  const categoryData = Object.values(categoryStats) as CategoryData[];

  // Articles par auteur
  const authorStats = articles.reduce((acc: any, article) => {
    const author = article.author || "Anonyme";
    if (!acc[author]) {
      acc[author] = { name: author, count: 0, views: 0 };
    }
    acc[author].count++;
    acc[author].views += article.views || 0;
    return acc;
  }, {});

  const authorData = Object.values(authorStats);

  // Évolution temporelle réelle (derniers 30 jours)
  const timelineData = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    const dateStr = format(date, "yyyy-MM-dd");

    // Compter les articles créés ce jour-là
    const articlesCreated = articles.filter(article => {
      const articleDate = format(new Date(article.created_at), "yyyy-MM-dd");
      return articleDate === dateStr;
    });

    // Calculer les vues totales des articles créés ce jour-là
    const totalViews = articlesCreated.reduce((sum, article) => sum + (article.views || 0), 0);

    return {
      date: format(date, "dd MMM", { locale: fr }),
      articles: articlesCreated.length,
      vues: totalViews,
    };
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Statistiques</h1>
        <p className="mt-2 text-sm text-gray-400">
          Analyses et performances de vos articles
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white">Total Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{articles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white">Total Vues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {articles.reduce((sum, a) => sum + (a.views || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white">Moyenne Vues/Article</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {articles.length > 0
                ? Math.round(articles.reduce((sum, a) => sum + (a.views || 0), 0) / articles.length)
                : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white">Catégories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{Object.keys(categoryStats).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Articles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Top 10 Articles par Vues</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topArticles}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182859" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fill: '#fff' }} />
                <YAxis tick={{ fill: '#fff' }} />
                <Tooltip contentStyle={{ backgroundColor: '#091626', border: '1px solid #182859' }} />
                <Bar dataKey="vues" fill="#F22E62" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Articles par catégorie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Répartition par Catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name} (${entry.count})`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#091626', border: '1px solid #182859' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Évolution des Vues (30 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182859" />
                <XAxis dataKey="date" tick={{ fill: '#fff' }} />
                <YAxis tick={{ fill: '#fff' }} />
                <Tooltip contentStyle={{ backgroundColor: '#091626', border: '1px solid #182859' }} />
                <Legend wrapperStyle={{ color: '#fff' }} />
                <Line type="monotone" dataKey="vues" stroke="#F22E62" activeDot={{ r: 8 }} name="Vues" />
                <Line type="monotone" dataKey="articles" stroke="#00C49F" name="Articles" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance par auteur */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Performance par Auteur</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={authorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182859" />
                <XAxis dataKey="name" tick={{ fill: '#fff' }} />
                <YAxis yAxisId="left" orientation="left" stroke="#F22E62" tick={{ fill: '#fff' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#00C49F" tick={{ fill: '#fff' }} />
                <Tooltip contentStyle={{ backgroundColor: '#091626', border: '1px solid #182859' }} />
                <Legend wrapperStyle={{ color: '#fff' }} />
                <Bar yAxisId="left" dataKey="count" fill="#F22E62" name="Nombre d'articles" />
                <Bar yAxisId="right" dataKey="views" fill="#00C49F" name="Total vues" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
