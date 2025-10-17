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
    { id: 'profile' as SidebarSection, label: 'Profil', icon: User },
    { id: 'favorite-teams' as SidebarSection, label: 'Équipes', icon: Heart },
    { id: 'security' as SidebarSection, label: 'Sécurité', icon: Shield },
    { id: 'preferences' as SidebarSection, label: 'Préférences', icon: Settings },
    { id: 'notifications' as SidebarSection, label: 'Notifications', icon: Bell },
  ];

  const handleLogout = () => {
    authService.logout();
    router.push('/');
  };

  return (
    <aside className="space-y-1">
      <nav className="space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#F22E62] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="h-4" />

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </nav>
    </aside>
  );
}
