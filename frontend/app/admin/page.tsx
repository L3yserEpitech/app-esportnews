"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Eye, TrendingUp, BarChart } from "lucide-react";
import { adminService, Article } from "@/lib/adminService";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/contexts/AuthContext";

export default function AdminDashboard() {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    totalViews: 0,
    avgViews: 0,
    topArticles: [] as Article[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated]);

  const loadStats = async () => {
    try {
      const data = await adminService.getArticleStats();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-400">
          Vue d'ensemble de votre contenu
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Total Articles
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <p className="text-xs text-gray-400">
              Articles publiés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Total Vues
            </CardTitle>
            <Eye className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.totalViews.toLocaleString()}
            </div>
            <p className="text-xs text-gray-400">
              Vues totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Moyenne Vues
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.avgViews}</div>
            <p className="text-xs text-gray-400">
              Par article
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">
              Top Performer
            </CardTitle>
            <BarChart className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.topArticles[0]?.views || 0}
            </div>
            <p className="text-xs text-gray-400">
              Vues max
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Articles */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Top 5 Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topArticles.map((article, index) => (
                <div
                  key={article.id}
                  className="flex items-center justify-between border-b border-[#182859] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#182859] text-sm font-medium text-white">
                        {index + 1}
                      </span>
                      <div>
                        <Link
                          href={`/admin/articles/${article.id}`}
                          className="font-medium text-white hover:text-[#F22E62]"
                        >
                          {article.title}
                        </Link>
                        <p className="text-sm text-gray-400">
                          {article.author} • {new Date(article.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-white">{article.views} vues</p>
                      <p className="text-sm text-gray-400">{article.category}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/articles/${article.id}/edit`}>
                        Modifier
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Actions Rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" asChild>
              <Link href="/admin/articles/new">
                <FileText className="mr-2 h-4 w-4" />
                Nouvel Article
              </Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin/articles">
                Voir tous les articles
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-white">Activité Récente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400">
              Dernière connexion : {new Date().toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
