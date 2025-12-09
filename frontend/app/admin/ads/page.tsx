"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminService, Ad } from "@/lib/adminService";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import Image from "next/image";

export default function AdsPage() {
  const router = useRouter();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adToDelete, setAdToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    try {
      const data = await adminService.getAllAds();
      setAds(data.sort((a, b) => a.position - b.position));
    } catch (error) {
      console.error("Error loading ads:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setAdToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (adToDelete === null) return;

    setDeleting(true);
    try {
      await adminService.deleteAd(adToDelete);
      await loadAds();
      setDeleteDialogOpen(false);
      setAdToDelete(null);
    } catch (error) {
      console.error("Error deleting ad:", error);
      alert("Erreur lors de la suppression de la publicité");
    } finally {
      setDeleting(false);
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Publicités</h1>
          <p className="mt-2 text-sm text-gray-400">
            Gérez les bannières publicitaires affichées sur le site
          </p>
        </div>
        <Button onClick={() => router.push("/admin/ads/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Publicité
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">
            Liste des Publicités ({ads.length}/3)
          </CardTitle>
          <CardDescription>
            Maximum 3 emplacements publicitaires disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Aucune publicité pour le moment</p>
              <Button
                onClick={() => router.push("/admin/ads/new")}
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter votre première publicité
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white">Position</TableHead>
                  <TableHead className="text-white">Aperçu</TableHead>
                  <TableHead className="text-white">Titre</TableHead>
                  <TableHead className="text-white">Type</TableHead>
                  <TableHead className="text-white">Lien</TableHead>
                  <TableHead className="text-white text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell className="text-white font-medium">
                      #{ad.position}
                    </TableCell>
                    <TableCell>
                      {ad.type === "image" && ad.url && (
                        <div className="relative w-20 h-12">
                          <Image
                            src={ad.url}
                            alt={ad.title}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                      )}
                      {ad.type === "video" && (
                        <div className="w-20 h-12 bg-gray-800 rounded flex items-center justify-center">
                          <span className="text-xs text-gray-400">Vidéo</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-white">{ad.title}</TableCell>
                    <TableCell className="text-gray-400 capitalize">
                      {ad.type}
                    </TableCell>
                    <TableCell>
                      {ad.redirect_link && (
                        <a
                          href={ad.redirect_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#F22E62] hover:underline flex items-center gap-1"
                        >
                          Lien
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/admin/ads/${ad.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(ad.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette publicité ? Cette action
              est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
