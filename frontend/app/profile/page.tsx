'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import ProfileSidebar from '../components/profile/ProfileSidebar';
import ProfileInfoSection from '../components/profile/sections/ProfileInfoSection';
import FavoriteTeamsSection from '../components/profile/sections/FavoriteTeamsSection';
import SecuritySection from '../components/profile/sections/SecuritySection';
import PreferencesSection from '../components/profile/sections/PreferencesSection';
import NotificationsSection from '../components/profile/sections/NotificationsSection';

type SidebarSection = 'profile' | 'favorite-teams' | 'security' | 'preferences' | 'notifications';

export default function ProfilePage() {
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
        <div className="text-white text-lg">Chargement...</div>
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
      default:
        return <ProfileInfoSection user={user} onUpdate={refreshUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060B13] via-[#091626] to-[#182859] pt-28 pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3">
            <ProfileSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
          </div>

          {/* Content */}
          <div className="lg:col-span-9">{renderSection()}</div>
        </div>
      </div>
    </div>
  );
}
