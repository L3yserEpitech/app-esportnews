'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { subscriptionService, SubscriptionStatus } from '@/app/services/subscriptionService';
import { CreditCard, Loader } from 'lucide-react';

export default function SubscriptionSection() {
  const t = useTranslations();
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch subscription status on mount
  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus();
    }
  }, [user]);

  const fetchSubscriptionStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        setErrorMessage('Authentication token not found');
        return;
      }

      const subStatus = await subscriptionService.getSubscriptionStatus(token);
      setStatus(subStatus);
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
      setErrorMessage('Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setActionLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('authToken');
      if (!token) {
        setErrorMessage('Authentication token not found');
        return;
      }

      await subscriptionService.createCheckoutSession(token);
      // Redirect happens in createCheckoutSession
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      setErrorMessage('Failed to create checkout session. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setActionLoading(true);
      setErrorMessage('');
      const token = localStorage.getItem('authToken');
      if (!token) {
        setErrorMessage('Authentication token not found');
        return;
      }

      const currentUrl = typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000/profile?section=subscription';
      await subscriptionService.openCustomerPortal(token, currentUrl);
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      setErrorMessage('Failed to open customer portal. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="animate-spin text-[#F22E62]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CreditCard className="w-6 h-6 text-[#F22E62]" />
        <h2 className="text-2xl font-bold">{t('pages.profile.subscription')}</h2>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Subscription Status Card */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              {t('pages.profile.subscription_status')}
            </span>
            {status?.premium ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                ✓ {t('pages.profile.premium_active')}
              </span>
            ) : (
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm font-semibold">
                {t('pages.profile.not_premium')}
              </span>
            )}
          </div>

          {/* Plan Details */}
          <div className="border-t dark:border-slate-700 pt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">{t('common.plan')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">esportnews Premium</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">{t('common.price')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{t('pages.profile.price_per_month')}</span>
            </div>

            {/* Billing Date */}
            {status?.premium && status?.subscription_current_period_end && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  {t('pages.profile.next_billing')}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {new Date(status.subscription_current_period_end).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Subscription Status Detail */}
            {status?.subscription_status && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  {t('pages.profile.subscription_status')}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white capitalize">
                  {status.subscription_status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex gap-3">
          {!status?.premium ? (
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="flex-1 bg-[#F22E62] hover:bg-[#d41e52] disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader className="w-4 h-4 animate-spin" />}
              {actionLoading ? t('common.loading') : t('pages.profile.subscribe')}
            </button>
          ) : (
            <button
              onClick={handleManageSubscription}
              disabled={actionLoading}
              className="flex-1 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader className="w-4 h-4 animate-spin" />}
              {actionLoading ? t('common.loading') : t('pages.profile.manage_subscription')}
            </button>
          )}
        </div>
      </div>

      {/* Benefits */}
      {!status?.premium && (
        <div className="bg-gradient-to-r from-[#F22E62] to-[#d41e52] rounded-lg p-6 text-white">
          <h3 className="font-bold text-lg mb-3">{t('pages.profile.why_premium')}</h3>
          <ul className="space-y-2 text-sm">
            <li>✓ {t('pages.profile.benefit_1')}</li>
            <li>✓ {t('pages.profile.benefit_2')}</li>
            <li>✓ {t('pages.profile.benefit_3')}</li>
            <li>✓ {t('pages.profile.benefit_4')}</li>
          </ul>
        </div>
      )}

      {/* Magazine Subscription Card */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <div className="space-y-4">
          <h3 className="font-bold text-lg">{t('pages.profile.subscribe_magazine')}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {t('pages.profile.magazine_description')}
          </p>
          <button
            onClick={() => window.open('https://magazine.esportnews.com', '_blank')}
            className="w-full bg-[#F22E62] hover:bg-[#d41e52] text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
          >
            {t('pages.profile.subscribe_magazine')}
          </button>
        </div>
      </div>
    </div>
  );
}
