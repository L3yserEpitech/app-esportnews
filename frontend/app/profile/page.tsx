'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../contexts/AuthContext';
import ProfileSidebar from '../components/profile/ProfileSidebar';
import ProfileNavDropdown from '../components/profile/ProfileNavDropdown';
import ProfileInfoSection from '../components/profile/sections/ProfileInfoSection';
import FavoriteTeamsSection from '../components/profile/sections/FavoriteTeamsSection';
import SecuritySection from '../components/profile/sections/SecuritySection';
import PreferencesSection from '../components/profile/sections/PreferencesSection';
import NotificationsSection from '../components/profile/sections/NotificationsSection';
import SubscriptionSection from './sections/SubscriptionSection';

type SidebarSection = 'profile' | 'favorite-teams' | 'security' | 'preferences' | 'notifications' | 'subscription';

export default function ProfilePage() {
  const t = useTranslations();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SidebarSection>('profile');

  // Redirection si non connecté
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#060B13] via-[#091626] to-[#182859] flex items-center justify-center">
        <div className="text-white text-lg">{t('pages.profile.chargement')}</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileInfoSection user={user} onUpdate={refreshUser} />;
      case 'favorite-teams':
        return <FavoriteTeamsSection />;
      case 'security':
        return <SecuritySection onUpdate={refreshUser} />;
      case 'preferences':
        return <PreferencesSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'subscription':
        return <SubscriptionSection />;
      default:
        return <ProfileInfoSection user={user} onUpdate={refreshUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060B13] via-[#091626] to-[#182859] pt-24 sm:pt-28 pb-12 sm:pb-16 px-3 sm:px-4 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white">{t('pages.profile.parametres')}</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">{t('pages.profile.gerez_profil_preferences')}</p>
        </div>

        {/* Dropdown mobile uniquement */}
        <div className="lg:hidden mb-4">
          <ProfileNavDropdown activeSection={activeSection} onSectionChange={setActiveSection} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
          {/* Sidebar desktop uniquement */}
          <div className="hidden lg:block lg:col-span-3">
            <ProfileSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
          </div>

          {/* Content */}
          <div className="lg:col-span-9">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
              {renderSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
