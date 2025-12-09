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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      // Filter out empty optional fields
      const cleanedData: any = {
        title: formData.title,
        article_content: formData.article_content,
      };

      // Only add optional fields if they have values
      if (formData.author?.trim()) cleanedData.author = formData.author;
      if (formData.subtitle?.trim()) cleanedData.subtitle = formData.subtitle;
      if (formData.category?.trim()) cleanedData.category = formData.category;
      if (formData.description?.trim()) cleanedData.description = formData.description;
      if (formData.featuredImage?.trim()) cleanedData.featuredImage = formData.featuredImage;
      if (formData.credit?.trim()) cleanedData.credit = formData.credit;
      if (formData.tags.length > 0) cleanedData.tags = formData.tags;

      // Don't send videoUrl/videoType if empty (backend constraint)

      await adminService.updateArticle(articleId, cleanedData);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F22E62]" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-white hover:text-white hover:bg-[#182859]">
            <Link href="/admin/articles">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">Modifier l'article</h1>
            <p className="mt-2 text-sm text-gray-400">
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
              <CardTitle className="text-white">Contenu Principal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label htmlFor="title" className="text-gray-300 mb-2">Titre *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Titre de l'article"
                  className="bg-[#060B13] border-[#182859] text-white placeholder:text-gray-500"
                />
              </div>

              <div>
                <Label htmlFor="subtitle" className="text-gray-300 mb-2">Sous-titre</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData({ ...formData, subtitle: e.target.value })
                  }
                  placeholder="Sous-titre (optionnel)"
                  className="bg-[#060B13] border-[#182859] text-white placeholder:text-gray-500"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-gray-300 mb-2">Description SEO</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description pour le référencement"
                  rows={3}
                  className="bg-[#060B13] border-[#182859] text-white placeholder:text-gray-500"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2">Contenu de l'article *</Label>
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
              <CardTitle className="text-white">Métadonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label htmlFor="author" className="text-gray-300 mb-2">Auteur</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) =>
                    setFormData({ ...formData, author: e.target.value })
                  }
                  placeholder="Nom de l'auteur"
                  className="bg-[#060B13] border-[#182859] text-white placeholder:text-gray-500"
                />
              </div>

              <div>
                <Label htmlFor="category" className="text-gray-300 mb-2">Catégorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger className="w-full bg-[#060B13] border-[#182859] text-white">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#091626] border-[#182859]">
                    <SelectItem value="Portrait" className="text-white hover:bg-[#182859]">Portrait</SelectItem>
                    <SelectItem value="Guide" className="text-white hover:bg-[#182859]">Guide</SelectItem>
                    <SelectItem value="Test produit" className="text-white hover:bg-[#182859]">Test produit</SelectItem>
                    <SelectItem value="Analyse" className="text-white hover:bg-[#182859]">Analyse</SelectItem>
                    <SelectItem value="Compétition" className="text-white hover:bg-[#182859]">Compétition</SelectItem>
                    <SelectItem value="Enquête" className="text-white hover:bg-[#182859]">Enquête</SelectItem>
                    <SelectItem value="Gaming" className="text-white hover:bg-[#182859]">Gaming</SelectItem>
                    <SelectItem value="Actus" className="text-white hover:bg-[#182859]">Actus</SelectItem>
                    <SelectItem value="Interview" className="text-white hover:bg-[#182859]">Interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="credit" className="text-gray-300 mb-2">Crédit / Source</Label>
                <Input
                  id="credit"
                  value={formData.credit}
                  onChange={(e) =>
                    setFormData({ ...formData, credit: e.target.value })
                  }
                  placeholder="© Studio X, VCT EMEA..."
                  className="bg-[#060B13] border-[#182859] text-white placeholder:text-gray-500"
                />
              </div>

              <div>
                <Label htmlFor="tags" className="text-gray-300 mb-2">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Ajouter un tag"
                    className="bg-[#060B13] border-[#182859] text-white placeholder:text-gray-500"
                  />
                  <Button type="button" onClick={addTag} size="sm">
                    Ajouter
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-[#182859] text-white border-[#182859]">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-[#F22E62]"
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
              <CardTitle className="text-white">Image de couverture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.featuredImage && (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-[#182859]">
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
                    className="w-full border-[#182859] text-white hover:bg-[#182859] hover:text-white"
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
