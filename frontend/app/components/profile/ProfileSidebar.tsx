'use client';

import { User, Shield, Heart, Bell, Settings, LogOut } from 'lucide-react';
import { authService } from '@/app/services/authService';
import { useRouter } from 'next/navigation';

type SidebarSection = 'profile' | 'favorite-teams' | 'security' | 'preferences' | 'notifications';

interface ProfileSidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export default function ProfileSidebar({ activeSection, onSectionChange }: ProfileSidebarProps) {
  const router = useRouter();

  const menuItems = [
    { id: 'profile' as SidebarSection, label: 'Mon Profil', icon: User },
    { id: 'favorite-teams' as SidebarSection, label: 'Équipes Favorites', icon: Heart },
    { id: 'security' as SidebarSection, label: 'Sécurité', icon: Shield },
    { id: 'preferences' as SidebarSection, label: 'Préférences', icon: Settings },
    { id: 'notifications' as SidebarSection, label: 'Notifications', icon: Bell },
  ];

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  return (
    <aside className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 h-fit sticky top-8">
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                isActive
                  ? 'bg-[#F22E62] text-white'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="border-t border-white/10 my-4" />

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </button>
      </nav>
    </aside>
  );
}
