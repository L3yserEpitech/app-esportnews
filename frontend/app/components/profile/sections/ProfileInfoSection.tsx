'use client';

import { useState, useRef } from 'react';
import { Camera, User, Mail, Save, X, CheckCircle, AlertCircle } from 'lucide-react';
import { authService } from '@/app/services/authService';
import { userService } from '@/app/services/userService';

interface ProfileInfoSectionProps {
  user: any;
  onUpdate: () => void;
}

export default function ProfileInfoSection({ user, onUpdate }: ProfileInfoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [avatar, setAvatar] = useState<string | null>(user?.photo || null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Veuillez sélectionner une image valide' });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: "L'image ne doit pas dépasser 5MB" });
        return;
      }

      setSelectedFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile || !user) return;

    try {
      setIsUploadingAvatar(true);
      setMessage(null);

      const token = authService.getToken();
      if (!token) {
        throw new Error('Non authentifié');
      }

      const response = await userService.uploadAvatar(token, selectedFile);

      setAvatar(response.photo.url);
      setPreviewAvatar(null);
      setSelectedFile(null);

      onUpdate();

      setMessage({ type: 'success', text: 'Photo de profil mise à jour avec succès' });
    } catch (error) {
      console.error("Erreur lors de l'upload:", error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Erreur lors de l'upload" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCancelAvatarChange = () => {
    setPreviewAvatar(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user) return;

    try {
      setIsLoading(true);
      setMessage(null);

      const token = authService.getToken();
      if (!token) {
        throw new Error('Non authentifié');
      }

      await userService.updateProfile(token, {
        name: formData.name,
        email: formData.email,
      });

      onUpdate();

      setMessage({ type: 'success', text: 'Profil mis à jour avec succès' });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Erreur lors de la mise à jour' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Informations du profil</h2>
        <p className="text-gray-400">Gérez vos informations personnelles</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span className={message.type === 'success' ? 'text-green-500' : 'text-red-500'}>
              {message.text}
            </span>
          </div>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        {/* Section Avatar */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative group">
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-[#F22E62]">
              {previewAvatar || avatar ? (
                <img src={previewAvatar || avatar || ''} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#182859] to-[#F22E62] flex items-center justify-center">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleAvatarClick}
              className="absolute bottom-0 right-0 bg-[#F22E62] hover:bg-[#F22E62]/80 text-white rounded-full p-3 transition-colors shadow-lg"
              disabled={isUploadingAvatar}
            >
              <Camera className="w-5 h-5" />
            </button>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>

          {selectedFile && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleUploadAvatar}
                disabled={isUploadingAvatar}
                className="px-4 py-2 bg-[#F22E62] hover:bg-[#F22E62]/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploadingAvatar ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Upload...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrer
                  </>
                )}
              </button>
              <button
                onClick={handleCancelAvatarChange}
                disabled={isUploadingAvatar}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
              Nom
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full pl-11 pr-4 py-3 bg-white/5 border ${
                  errors.name ? 'border-red-500' : 'border-white/10'
                } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F22E62] focus:border-transparent transition-all`}
                placeholder="Votre nom"
              />
            </div>
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full pl-11 pr-4 py-3 bg-white/5 border ${
                  errors.email ? 'border-red-500' : 'border-white/10'
                } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F22E62] focus:border-transparent transition-all`}
                placeholder="votre@email.com"
              />
            </div>
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#F22E62] hover:bg-[#F22E62]/80 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Mise à jour en cours...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Enregistrer les modifications
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
