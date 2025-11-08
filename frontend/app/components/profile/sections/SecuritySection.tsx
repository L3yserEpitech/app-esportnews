'use client';

import { useState } from 'react';
import { Lock, Check, X, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { authService } from '@/app/services/authService';
import { userService } from '@/app/services/userService';

interface SecuritySectionProps {
  onUpdate: () => void;
}

export default function SecuritySection({ onUpdate }: SecuritySectionProps) {
  const t = useTranslations();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = t('profile.security_section.mot_de_passe_actuel_requis');
    }

    if (!formData.newPassword) {
      newErrors.newPassword = t('profile.security_section.nouveau_mot_de_passe_requis');
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = t('profile.security_section.mot_de_passe_min_6');
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('profile.security_section.mots_de_passe_ne_correspondent');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsLoading(true);
      setMessage(null);

      const token = authService.getToken();
      if (!token) {
        throw new Error('Non authentifié');
      }

      await userService.updateProfile(token, {
        password: formData.newPassword,
      });

      onUpdate();

      setMessage({ type: 'success', text: t('profile.security_section.mot_de_passe_modifie') });

      // Réinitialiser le formulaire
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Erreur lors de la mise à jour' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message de feedback */}
      {message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-xs sm:text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          <span className="flex-1 break-words">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Mot de passe actuel */}
        <div>
          <label htmlFor="currentPassword" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
            {t('profile.security_section.mot_de_passe_actuel')}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPasswords.current ? 'text' : 'password'}
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleInputChange}
              className={`w-full pl-10 pr-12 py-2.5 bg-white/5 border ${
                errors.currentPassword ? 'border-red-500/50' : 'border-white/10'
              } rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#F22E62] focus:border-[#F22E62] transition-all`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('current')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.currentPassword && <p className="mt-1.5 text-xs text-red-400">{errors.currentPassword}</p>}
        </div>

        {/* Nouveau mot de passe */}
        <div>
          <label htmlFor="newPassword" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
            {t('profile.security_section.nouveau_mot_de_passe')}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPasswords.new ? 'text' : 'password'}
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleInputChange}
              className={`w-full pl-10 pr-12 py-2.5 bg-white/5 border ${
                errors.newPassword ? 'border-red-500/50' : 'border-white/10'
              } rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#F22E62] focus:border-[#F22E62] transition-all`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('new')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.newPassword && <p className="mt-1.5 text-xs text-red-400">{errors.newPassword}</p>}
        </div>

        {/* Confirmer le mot de passe */}
        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
            {t('profile.security_section.confirmer_mot_de_passe')}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPasswords.confirm ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`w-full pl-10 pr-12 py-2.5 bg-white/5 border ${
                errors.confirmPassword ? 'border-red-500/50' : 'border-white/10'
              } rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#F22E62] focus:border-[#F22E62] transition-all`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('confirm')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="mt-1.5 text-xs text-red-400">{errors.confirmPassword}</p>}
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-[#F22E62] hover:bg-[#F22E62]/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('profile.security_section.enregistrement')}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{t('profile.security_section.modifier_mot_de_passe')}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Informations de sécurité */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <p className="text-xs text-gray-500 leading-relaxed">
          {t('profile.security_section.info_securite')}
        </p>
      </div>
    </div>
  );
}
