'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({
    email: '',
    password: '',
    general: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {
      email: '',
      password: '',
      general: '',
    };

    let isValid = true;

    if (!formData.email.trim()) {
      newErrors.email = t('pages.login.email_requis');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('pages.login.email_invalide');
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = t('pages.login.mot_de_passe_requis');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, general: '' }));

    try {
      await login({
        email: formData.email,
        password: formData.password,
      });

      router.push('/');
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        general: error instanceof Error ? error.message : t('pages.login.erreur_connexion'),
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="bg-bg-primary relative overflow-hidden min-h-screen flex items-center justify-center px-4 pt-20">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#F22E62]/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#182859]/40 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F22E62]/10 rounded-full blur-3xl"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>

      <div className="relative w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left side - Branding */}
        <div className="hidden lg:block space-y-8">
          <Link href="/" className="inline-block">
            <Image
              src="/logo_blanc.png"
              alt="EsportNews"
              width={280}
              height={180}
              className="h-16 w-auto"
              priority
            />
          </Link>

          <div className="space-y-6">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-[#F22E62]/10 border border-[#F22E62]/20 rounded-full">
              <Sparkles className="w-4 h-4 text-[#F22E62]" />
              <span className="text-sm font-medium text-[#F22E62]">{t('pages.login.content_de_vous_revoir')}</span>
            </div>

            <h1 className="text-5xl font-bold text-text-primary leading-tight">
              Connectez-vous à<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F22E62] to-pink-400">
                EsportNews
              </span>
            </h1>

            <p className="text-xl text-text-secondary leading-relaxed">
              Accédez à votre espace personnel
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-[#F22E62]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#F22E62]"></div>
                </div>
                <div>
                  <h3 className="text-text-primary font-semibold">Personnalisez votre expérience</h3>
                  <p className="text-text-secondary text-sm">Suivez vos jeux et équipes préférées</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-[#F22E62]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#F22E62]"></div>
                </div>
                <div>
                  <h3 className="text-text-primary font-semibold">Notifications en temps réel</h3>
                  <p className="text-text-secondary text-sm">Ne manquez aucun match important</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-[#F22E62]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#F22E62]"></div>
                </div>
                <div>
                  <h3 className="text-text-primary font-semibold">Communauté active</h3>
                  <p className="text-text-secondary text-sm">Échangez avec d'autres passionnés</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="w-full max-w-md mx-auto lg:ml-auto lg:mr-0 mt-5">
          <div className="lg:bg-bg-secondary/30 lg:backdrop-blur-xl lg:rounded-3xl lg:p-8 lg:shadow-2xl">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-text-primary mb-2">{t('pages.login.connexion')}</h2>
              <p className="text-text-secondary">{t('pages.login.acces_compte')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {errors.general && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 animate-fade-in">
                  <p className="text-red-600 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                  {t('pages.login.adresse_email')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-text-muted" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-3.5 bg-bg-primary/50 border ${errors.email ? 'border-red-500/50' : 'border-border-primary/50'
                      } rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-all`}
                    placeholder={t('pages.login.placeholder_email')}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <span>•</span>
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* Mot de passe */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                    {t('pages.login.mot_de_passe')}
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-[#F22E62] hover:text-[#F22E62]/80 transition-colors"
                  >
                    {t('pages.login.mot_de_passe_oublie')}
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-text-muted" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-3.5 bg-bg-primary/50 border ${errors.password ? 'border-red-500/50' : 'border-border-primary/50'
                      } rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-all`}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                    <span>•</span>
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {/* Bouton de soumission */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#F22E62] to-pink-400 text-white font-semibold py-4 px-4 rounded-xl hover:from-[#F22E62]/90 hover:to-pink-400/90 focus:outline-none focus:ring-2 focus:ring-[#F22E62]/50 focus:ring-offset-2 focus:ring-offset-bg-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#F22E62]/20 group mt-6"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('pages.login.connexion_en_cours')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-2">
                    <span>{t('pages.login.se_connecter')}</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-primary/50"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-bg-secondary/60 text-text-muted">{t('pages.login.ou')}</span>
              </div>
            </div>

            {/* Lien vers l'inscription */}
            <div className="text-center">
              <p className="text-text-secondary text-sm mb-4">
                {t('pages.login.pas_compte_encore')}
              </p>
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center space-x-2 w-full px-4 py-3.5 bg-gradient-to-r from-[#F22E62] to-pink-400 text-white font-medium rounded-xl hover:from-[#F22E62]/90 hover:to-pink-400/90 transition-all group shadow-lg shadow-[#F22E62]/20"
              >
                <span>{t('pages.login.creer_compte')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Retour à l'accueil */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              {t('pages.login.retour_accueil')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
