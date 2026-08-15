'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lock, ArrowRight, ArrowLeft, ShieldAlert } from 'lucide-react';
import DynamicLogo from '@/app/components/common/DynamicLogo';
import { authService } from '@/app/services/authService';
import { useAuth } from '@/app/contexts/AuthContext';

function ResetPasswordForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError(t('pages.reset_password.min_length'));
      return;
    }
    if (password !== confirm) {
      setError(t('pages.reset_password.mismatch'));
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { authToken } = await authService.resetPassword(token, password);
      // Le backend renvoie une session complète : on enchaîne directement sur
      // l'accueil connecté plutôt que de renvoyer vers le formulaire de login.
      authService.setToken(authToken);
      await refreshUser();
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.reset_password.invalid_link'));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (invalid: boolean) =>
    `w-full pl-12 pr-4 py-3.5 bg-bg-primary/50 border ${
      invalid ? 'border-red-500/50' : 'border-border-primary/50'
    } rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-all`;

  if (!token) {
    return (
      <div className="text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary">
          {t('pages.reset_password.invalid_link')}
        </h2>
        <Link
          href="/auth/forgot-password"
          className="inline-flex items-center justify-center space-x-2 w-full px-4 py-3.5 bg-gradient-to-r from-[#F22E62] to-pink-400 text-white font-medium rounded-xl hover:from-[#F22E62]/90 hover:to-pink-400/90 transition-all"
        >
          <span>{t('pages.reset_password.request_new')}</span>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-text-primary mb-2">
          {t('pages.reset_password.title')}
        </h2>
        <p className="text-text-secondary">{t('pages.reset_password.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
            {t('pages.reset_password.password_label')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-text-muted" />
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              className={inputClass(Boolean(error))}
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-text-secondary mb-2">
            {t('pages.reset_password.confirm_label')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-text-muted" />
            </div>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error) setError('');
              }}
              className={inputClass(Boolean(error))}
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-[#F22E62] to-pink-400 text-white font-semibold py-4 px-4 rounded-xl hover:from-[#F22E62]/90 hover:to-pink-400/90 focus:outline-none focus:ring-2 focus:ring-[#F22E62]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#F22E62]/20 group mt-2"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('pages.reset_password.saving')}
            </span>
          ) : (
            <span className="flex items-center justify-center space-x-2">
              <span>{t('pages.reset_password.submit')}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations();

  return (
    <div className="bg-bg-primary relative overflow-hidden min-h-screen flex items-center justify-center px-4 pt-20">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#F22E62]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F22E62]/10 rounded-full blur-3xl"></div>
      </div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="inline-block">
            <DynamicLogo width={220} height={140} className="h-14 w-auto" priority />
          </Link>
        </div>

        <div className="lg:bg-bg-secondary/30 lg:backdrop-blur-xl lg:rounded-3xl lg:p-8 lg:shadow-2xl">
          <Suspense fallback={<div className="h-64" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center space-x-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('pages.forgot_password.back_to_login')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
