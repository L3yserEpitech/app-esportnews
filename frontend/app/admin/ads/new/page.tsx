"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminService, CreateAdInput } from "@/lib/adminService";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import Image from "next/image";

export default function NewAdPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreateAdInput>({
    title: "",
    position: 1,
    type: "image",
    url: "",
    redirect_link: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner une image");
      return;
    }

    setUploading(true);
    try {
      const { url } = await adminService.uploadAdImage(file);
      setFormData({ ...formData, url });
      setImagePreview(url);
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Erreur lors de l'upload de l'image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("Le titre est requis");
      return;
    }

    if (!formData.url.trim()) {
      alert("L'image ou la vidéo est requise");
      return;
    }

    if (!formData.redirect_link.trim()) {
      alert("Le lien de redirection est requis");
      return;
    }

    setSaving(true);
    try {
      await adminService.createAd(formData);
      router.push("/admin/ads");
    } catch (error) {
      console.error("Error creating ad:", error);
      alert("Erreur lors de la création de la publicité");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/admin/ads")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux publicités
        </Button>
        <h1 className="text-3xl font-bold text-white">Nouvelle Publicité</h1>
        <p className="mt-2 text-sm text-gray-400">
          Créez une nouvelle bannière publicitaire
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Informations</CardTitle>
          <CardDescription>
            Remplissez les informations de la publicité
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-white">
                Titre *
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Ex: Bannière Partenaire XYZ"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position" className="text-white">
                Position (1-3) *
              </Label>
              <Select
                value={String(formData.position)}
                onValueChange={(value) =>
                  setFormData({ ...formData, position: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Position 1 (Haut)</SelectItem>
                  <SelectItem value="2">Position 2 (Milieu)</SelectItem>
                  <SelectItem value="3">Position 3 (Bas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-white">
                Type de média *
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Vidéo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === "image" && (
              <div className="space-y-2">
                <Label htmlFor="image" className="text-white">
                  Image *
                </Label>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={uploading}
                    />
                    {uploading && (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    )}
                  </div>
                  {imagePreview && (
                    <div className="relative w-full h-48 border border-gray-700 rounded-lg overflow-hidden">
                      <Image
                        src={imagePreview}
                        alt="Aperçu"
                        fill
                        className="object-contain"
                      />
                    </div>
                  )}
                  <p className="text-sm text-gray-400">
                    Format recommandé: 300x600px (Bannière verticale)
                  </p>
                </div>
              </div>
            )}

            {formData.type === "video" && (
              <div className="space-y-2">
                <Label htmlFor="video_url" className="text-white">
                  URL de la vidéo *
                </Label>
                <Input
                  id="video_url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com/video.mp4"
                  type="url"
                  required
                />
                <p className="text-sm text-gray-400">
                  Formats supportés: MP4, WebM
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="redirect_link" className="text-white">
                Lien de redirection *
              </Label>
              <Input
                id="redirect_link"
                value={formData.redirect_link}
                onChange={(e) =>
                  setFormData({ ...formData, redirect_link: e.target.value })
                }
                placeholder="https://example.com"
                type="url"
                required
              />
              <p className="text-sm text-gray-400">
                URL vers laquelle l'utilisateur sera redirigé en cliquant sur la
                publicité
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/ads")}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving || uploading}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer la publicité"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
