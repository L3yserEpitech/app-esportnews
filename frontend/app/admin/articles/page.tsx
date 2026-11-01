"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminService, Article } from "@/lib/adminService";
import { useGame } from "@/app/contexts/GameContext";
import { articleHref } from "@/app/lib/articleUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Pencil, Trash2, Eye } from "lucide-react";

export default function ArticlesListPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { games } = useGame();
  const gamesById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  useEffect(() => {
    loadArticles();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const filtered = articles.filter((article) => {
        const game = article.game_id != null ? gamesById.get(article.game_id) : undefined;
        return (
          article.title.toLowerCase().includes(q) ||
          article.author?.toLowerCase().includes(q) ||
          article.category?.toLowerCase().includes(q) ||
          game?.name?.toLowerCase().includes(q) ||
          game?.full_name?.toLowerCase().includes(q)
        );
      });
      setFilteredArticles(filtered);
    } else {
      setFilteredArticles(articles);
    }
  }, [searchQuery, articles, gamesById]);

  const loadArticles = async () => {
    try {
      const data = await adminService.getAllArticles();
      setArticles(data);
      setFilteredArticles(data);
    } catch (error) {
      console.error("Error loading articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!articleToDelete) return;

    setDeleting(true);
    try {
      await adminService.deleteArticle(articleToDelete.id);
      setArticles(articles.filter((a) => a.id !== articleToDelete.id));
      setArticleToDelete(null);
    } catch (error) {
      console.error("Error deleting article:", error);
      alert("Erreur lors de la suppression de l'article");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F22E62]" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Articles</h1>
            <p className="mt-2 text-sm text-gray-400">
              Gérez vos articles ({filteredArticles.length})
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/articles/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nouvel Article
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Rechercher par titre, auteur, catégorie ou jeu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#091626] border-[#182859] text-white placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Articles Table */}
      <div className="bg-[#091626] rounded-lg shadow border border-[#182859]">
        <Table>
          <TableHeader>
            <TableRow className="border-[#182859] hover:bg-[#182859]/30">
              <TableHead className="text-gray-300">Titre</TableHead>
              <TableHead className="text-gray-300">Auteur</TableHead>
              <TableHead className="text-gray-300">Catégorie</TableHead>
              <TableHead className="text-gray-300">Jeu</TableHead>
              <TableHead className="text-gray-300">Vues</TableHead>
              <TableHead className="text-gray-300">Date</TableHead>
              <TableHead className="text-right text-gray-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredArticles.map((article) => {
              const game = article.game_id != null ? gamesById.get(article.game_id) : undefined;
              return (
              <TableRow key={article.id} className="border-[#182859] hover:bg-[#182859]/20">
                <TableCell className="font-medium text-white">
                  <Link
                    href={articleHref(article)}
                    className="hover:text-[#F22E62] flex items-center gap-2"
                    target="_blank"
                  >
                    {article.title}
                    <Eye className="h-3 w-3" />
                  </Link>
                </TableCell>
                <TableCell className="text-gray-400">{article.author || "—"}</TableCell>
                <TableCell>
                  {article.category ? (
                    <Badge variant="outline" className="border-[#182859] text-[#F22E62]">{article.category}</Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {game ? (
                    <Badge variant="outline" title={game.full_name} className="border-[#182859] text-white">
                      {game.name}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-gray-400">{article.views || 0}</TableCell>
                <TableCell className="text-gray-400">
                  {new Date(article.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild className="border-[#182859] text-white hover:bg-[#182859] hover:text-white">
                      <Link href={`/admin/articles/${article.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setArticleToDelete(article)}
                      className="bg-[#F22E62] hover:bg-[#F22E62]/80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredArticles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Aucun article trouvé</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!articleToDelete}
        onOpenChange={() => setArticleToDelete(null)}
      >
        <AlertDialogContent className="bg-[#091626] border-[#182859]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Êtes-vous sûr de vouloir supprimer l'article "{articleToDelete?.title}" ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#182859] text-white hover:bg-[#182859]">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#F22E62] hover:bg-[#F22E62]/80 text-white"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
