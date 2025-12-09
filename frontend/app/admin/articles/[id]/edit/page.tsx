"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { adminService, Article } from "@/lib/adminService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TiptapEditor } from "@/components/admin/TiptapEditor";
import { ArrowLeft, Save, Upload } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const articleId = parseInt(params.id as string);

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    article_content: "",
    author: "",
    subtitle: "",
    category: "",
    description: "",
    featuredImage: "",
    videoUrl: "",
    videoType: "",
    credit: "",
    tags: [] as string[],
  });

  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (articleId) {
      loadArticle();
    }
  }, [articleId]);

  const loadArticle = async () => {
    try {
      const data = await adminService.getArticleById(articleId);
      setArticle(data);
      setFormData({
        title: data.title || "",
        article_content: data.article_content || data.content || "",
        author: data.author || "",
        subtitle: data.subtitle || "",
        category: data.category || "",
        description: data.description || "",
        featuredImage: data.featuredImage || "",
        videoUrl: data.videoUrl || "",
        videoType: data.videoType || "",
        credit: data.credit || "",
        tags: data.tags || [],
      });
    } catch (error) {
      console.error("Error loading article:", error);
      alert("Erreur lors du chargement de l'article");
    } finally {
      setLoading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { url } = await adminService.uploadCoverMedia(file);
      setFormData({ ...formData, featuredImage: url });
    } catch (error) {
      console.error("Error uploading cover:", error);
      alert("Erreur lors de l'upload de l'image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.article_content) {
      alert("Le titre et le contenu sont obligatoires");
      return;
    }

    setSaving(true);
    try {
      await adminService.updateArticle(articleId, formData);
      alert("Article mis à jour avec succès !");
      router.push("/admin/articles");
    } catch (error) {
      console.error("Error saving article:", error);
      alert("Erreur lors de la sauvegarde de l'article");
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/articles">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Modifier l'article</h1>
            <p className="mt-2 text-sm text-gray-700">
              ID: {articleId} • {article?.views || 0} vues
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contenu Principal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Titre de l'article"
                />
              </div>

              <div>
                <Label htmlFor="subtitle">Sous-titre</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData({ ...formData, subtitle: e.target.value })
                  }
                  placeholder="Sous-titre (optionnel)"
                />
              </div>

              <div>
                <Label htmlFor="description">Description SEO</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description pour le référencement"
                  rows={3}
                />
              </div>

              <div>
                <Label>Contenu de l'article *</Label>
                <TiptapEditor
                  content={formData.article_content}
                  onChange={(content) =>
                    setFormData({ ...formData, article_content: content })
                  }
                  placeholder="Rédigez votre article ici..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Métadonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="author">Auteur</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) =>
                    setFormData({ ...formData, author: e.target.value })
                  }
                  placeholder="Nom de l'auteur"
                />
              </div>

              <div>
                <Label htmlFor="category">Catégorie</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  placeholder="Interview, News, Guide..."
                />
              </div>

              <div>
                <Label htmlFor="credit">Crédit / Source</Label>
                <Input
                  id="credit"
                  value={formData.credit}
                  onChange={(e) =>
                    setFormData({ ...formData, credit: e.target.value })
                  }
                  placeholder="© Studio X, VCT EMEA..."
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Ajouter un tag"
                  />
                  <Button type="button" onClick={addTag} size="sm">
                    Ajouter
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Image de couverture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.featuredImage && (
                <div className="relative aspect-video rounded-lg overflow-hidden">
                  <img
                    src={formData.featuredImage}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="cover-upload">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={uploading}
                    onClick={() => document.getElementById("cover-upload")?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Upload en cours..." : "Changer l'image"}
                  </Button>
                </Label>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
