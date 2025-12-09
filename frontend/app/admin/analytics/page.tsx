"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  analyticsService, 
  VisitorStats, 
  RegistrationStats,
  Timeline 
} from "@/lib/analyticsService";
import { authService } from "@/app/services/authService";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Eye, 
  UserPlus, 
  Download,
  TrendingUp,
  Activity 
} from "lucide-react";

const COLORS = {
  primary: "#F22E62",
  secondary: "#182859",
  accent: "#00C49F",
};

type Tab = "visitors" | "registrations" | "combined";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("visitors");
  const [timeline, setTimeline] = useState<Timeline>("24h");
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  const [registrationStats, setRegistrationStats] = useState<RegistrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [timeline]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Récupérer le token d'authentification
      const token = authService.getToken();
      
      if (!token) {
        setError("Non authentifié - Veuillez vous reconnecter");
        setLoading(false);
        return;
      }

      const [visitors, registrations] = await Promise.all([
        analyticsService.getVisitorStats(timeline, token),
        analyticsService.getRegistrationStats(timeline, token),
      ]);

      setVisitorStats(visitors);
      setRegistrationStats(registrations);
    } catch (err) {
      console.error("Error loading analytics:", err);
      setError("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = authService.getToken();
      if (!token) {
        alert("Non authentifié - Impossible d'exporter");
        setExporting(false);
        return;
      }
      const blob = await analyticsService.exportCSV(timeline, token);
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${timeline}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error exporting analytics:", err);
      alert("Erreur lors de l'export des données");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F22E62]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  // Préparer les données pour les graphiques
  const visitorChartData = visitorStats?.breakdown.map(item => ({
    date: format(parseISO(item.date), 'dd MMM', { locale: fr }),
    visiteurs: item.visitors,
    vues: item.views,
  })) || [];

  const registrationChartData = registrationStats?.breakdown.map(item => ({
    date: format(parseISO(item.date), 'dd MMM', { locale: fr }),
    inscriptions: item.count,
  })) || [];

  // Données combinées pour le graphique "Vue d'ensemble"
  const combinedData = visitorStats?.breakdown.map((item, index) => ({
    date: format(parseISO(item.date), 'dd MMM', { locale: fr }),
    visiteurs: item.visitors,
    vues: item.views,
    inscriptions: registrationStats?.breakdown[index]?.count || 0,
  })) || [];

  const timelineOptions: { value: Timeline; label: string }[] = [
    { value: '24h', label: '24 heures' },
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' },
    { value: 'year', label: 'Année' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-2">
            Statistiques de visiteurs et inscriptions
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting}
          variant="outline"
          className="gap-2"
        >
          <Download size={16} />
          {exporting ? 'Export en cours...' : 'Exporter CSV'}
        </Button>
      </div>

      {/* Timeline Selector */}
      <div className="flex gap-2">
        {timelineOptions.map(option => (
          <Button
            key={option.value}
            onClick={() => setTimeline(option.value)}
            variant={timeline === option.value ? "default" : "outline"}
            size="sm"
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab("visitors")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "visitors"
              ? "text-[#F22E62] border-b-2 border-[#F22E62]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Visiteurs
        </button>
        <button
          onClick={() => setActiveTab("registrations")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "registrations"
              ? "text-[#F22E62] border-b-2 border-[#F22E62]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Inscriptions
        </button>
        <button
          onClick={() => setActiveTab("combined")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "combined"
              ? "text-[#F22E62] border-b-2 border-[#F22E62]"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Vue d'ensemble
        </button>
      </div>

      {/* KPI Cards */}
      {activeTab === "visitors" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Visiteurs Uniques
                </CardTitle>
                <Users className="h-4 w-4 text-[#F22E62]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {visitorStats?.total_visitors.toLocaleString('fr-FR')}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Moyenne: {visitorStats?.avg_per_day.toFixed(1)} / jour
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Pages Vues
                </CardTitle>
                <Eye className="h-4 w-4 text-[#182859]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {visitorStats?.total_pageviews.toLocaleString('fr-FR')}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {visitorStats && visitorStats.total_visitors > 0
                    ? `${(visitorStats.total_pageviews / visitorStats.total_visitors).toFixed(1)} pages / visiteur`
                    : '0 pages / visiteur'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Engagement
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-[#00C49F]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {visitorStats && visitorStats.total_visitors > 0
                    ? `${((visitorStats.total_pageviews / visitorStats.total_visitors) * 100).toFixed(0)}%`
                    : '0%'}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Taux d'interaction moyen
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution des visiteurs</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={visitorChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#888" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="visiteurs"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    name="Visiteurs Uniques"
                  />
                  <Line
                    type="monotone"
                    dataKey="vues"
                    stroke={COLORS.secondary}
                    strokeWidth={2}
                    name="Pages Vues"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "registrations" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Nouvelles Inscriptions
                </CardTitle>
                <UserPlus className="h-4 w-4 text-[#F22E62]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {registrationStats?.total_users.toLocaleString('fr-FR')}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Moyenne: {registrationStats?.avg_per_day.toFixed(1)} / jour
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Taux de Conversion
                </CardTitle>
                <Activity className="h-4 w-4 text-[#00C49F]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {visitorStats && registrationStats && visitorStats.total_visitors > 0
                    ? `${((registrationStats.total_users / visitorStats.total_visitors) * 100).toFixed(2)}%`
                    : '0%'}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Visiteurs → Utilisateurs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Croissance
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-[#182859]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {registrationStats && registrationStats.breakdown.length > 1
                    ? (() => {
                        const recent = registrationStats.breakdown.slice(-7).reduce((sum, item) => sum + item.count, 0);
                        const previous = registrationStats.breakdown.slice(-14, -7).reduce((sum, item) => sum + item.count, 0);
                        const growth = previous > 0 ? ((recent - previous) / previous * 100).toFixed(0) : '0';
                        return `${growth}%`;
                      })()
                    : '0%'}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  vs période précédente
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution des inscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={registrationChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#888" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="inscriptions"
                    fill={COLORS.primary}
                    name="Nouvelles Inscriptions"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "combined" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Visiteurs
                </CardTitle>
                <Users className="h-4 w-4 text-[#F22E62]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {visitorStats?.total_visitors.toLocaleString('fr-FR')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Pages Vues
                </CardTitle>
                <Eye className="h-4 w-4 text-[#182859]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {visitorStats?.total_pageviews.toLocaleString('fr-FR')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Inscriptions
                </CardTitle>
                <UserPlus className="h-4 w-4 text-[#00C49F]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {registrationStats?.total_users.toLocaleString('fr-FR')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Conversion
                </CardTitle>
                <Activity className="h-4 w-4 text-[#F22E62]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {visitorStats && registrationStats && visitorStats.total_visitors > 0
                    ? `${((registrationStats.total_users / visitorStats.total_visitors) * 100).toFixed(2)}%`
                    : '0%'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Combined Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Vue d'ensemble complète</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#888" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="visiteurs"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    name="Visiteurs"
                  />
                  <Line
                    type="monotone"
                    dataKey="inscriptions"
                    stroke={COLORS.accent}
                    strokeWidth={2}
                    name="Inscriptions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

