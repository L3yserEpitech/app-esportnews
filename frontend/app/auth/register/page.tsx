'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { User, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    general: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      general: '',
    };

    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Le nom doit contenir au moins 2 caractères';
      isValid = false;
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
      isValid = false;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Veuillez confirmer votre mot de passe';
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
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
      await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      router.push('/');
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        general: error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'inscription',
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
    <div className="bg-[#060B13] relative overflow-hidden min-h-screen flex items-center justify-center px-4 pt-20">
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
              <span className="text-sm font-medium text-[#F22E62]">Rejoignez la communauté</span>
            </div>

            <h1 className="text-5xl font-bold text-white leading-tight">
              Bienvenue sur<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F22E62] to-pink-400">
                EsportNews
              </span>
            </h1>

            <p className="text-xl text-gray-400 leading-relaxed">
              Suivez l'actualité esport en temps réel et ne manquez aucun match de vos jeux préférés.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-[#F22E62]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#F22E62]"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Matchs en direct</h3>
                  <p className="text-gray-400 text-sm">Suivez tous les matchs live multi-jeux</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-[#F22E62]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#F22E62]"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Actualités exclusives</h3>
                  <p className="text-gray-400 text-sm">Restez informé des dernières news</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-[#F22E62]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#F22E62]"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Tournois & Calendrier</h3>
                  <p className="text-gray-400 text-sm">Ne ratez aucune compétition importante</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="w-full max-w-md mx-auto lg:ml-auto lg:mr-0">
          <div className="bg-[#091626]/30 backdrop-blur-xl rounded-3xl p-8 shadow-2xl mt-5">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Créer un compte</h2>
              <p className="text-gray-400">Remplissez les informations ci-dessous</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {errors.general && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 animate-fade-in">
                  <p className="text-red-400 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Nom */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Nom complet
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-3.5 bg-[#060B13]/50 border ${errors.name ? 'border-red-500/50' : 'border-[#182859]/50'
                      } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F22E62]/50 focus:border-transparent transition-all`}
                    placeholder="John Doe"
                    disabled={isLoading}
                  />
                </div>
                {errors.name && (
                  <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                    <span>•</span>
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Adresse email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-3.5 bg-[#060B13]/50 border ${errors.email ? 'border-red-500/50' : 'border-[#182859]/50'
                      } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F22E62]/50 focus:border-transparent transition-all`}
                    placeholder="john@exemple.com"
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                    <span>•</span>
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* Mot de passe */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-3.5 bg-[#060B13]/50 border ${errors.password ? 'border-red-500/50' : 'border-[#182859]/50'
                      } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F22E62]/50 focus:border-transparent transition-all`}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                    <span>•</span>
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {/* Confirmation mot de passe */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-3.5 bg-[#060B13]/50 border ${errors.confirmPassword ? 'border-red-500/50' : 'border-[#182859]/50'
                      } rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F22E62]/50 focus:border-transparent transition-all`}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                    <span>•</span>
                    <span>{errors.confirmPassword}</span>
                  </p>
                )}
              </div>

              {/* Bouton de soumission */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-pink-600 to-pink-400 text-white font-semibold py-4 px-4 rounded-xl hover:from-pink-600/90 hover:to-pink-400/90 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:ring-offset-2 focus:ring-offset-[#091626] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-600/20 group mt-6"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Création en cours...
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-2">
                    <span>Créer mon compte</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </form>

            {/* Lien vers la connexion */}
            <div className="mt-8 text-center">
              <p className="text-gray-400 text-sm">
                Vous avez déjà un compte ?{' '}
                <Link
                  href="/auth/login"
                  className="text-[#F22E62] hover:text-pink-400 font-semibold transition-colors"
                >
                  Se connecter
                </Link>
              </p>
            </div>
          </div>

          {/* Mentions légales */}
          <p className="mt-6 text-center text-gray-500 text-xs">
            En créant un compte, vous acceptez nos{' '}
            <Link href="/legal/terms" className="underline hover:text-gray-400">
              conditions d'utilisation
            </Link>{' '}
            et notre{' '}
            <Link href="/legal/privacy" className="underline hover:text-gray-400">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
