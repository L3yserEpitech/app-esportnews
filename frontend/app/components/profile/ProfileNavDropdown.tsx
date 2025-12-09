'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Shield, Heart, Bell, Settings, ChevronDown, CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';

type SidebarSection = 'profile' | 'favorite-teams' | 'security' | 'preferences' | 'notifications' | 'subscription';

interface ProfileNavDropdownProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export default function ProfileNavDropdown({ activeSection, onSectionChange }: ProfileNavDropdownProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    { id: 'profile' as SidebarSection, label: t('profile.sidebar.profil'), icon: User },
    { id: 'favorite-teams' as SidebarSection, label: t('profile.sidebar.equipes'), icon: Heart },
    { id: 'security' as SidebarSection, label: t('profile.sidebar.securite'), icon: Shield },
    // { id: 'preferences' as SidebarSection, label: t('profile.sidebar.preferences'), icon: Settings },
    { id: 'notifications' as SidebarSection, label: t('profile.sidebar.notifications'), icon: Bell },
    // { id: 'subscription' as SidebarSection, label: t('profile.sidebar.subscription'), icon: CreditCard },
  ];

  const activeItem = menuItems.find(item => item.id === activeSection);
  const ActiveIcon = activeItem?.icon || User;

  // Fermer le dropdown quand on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (section: SidebarSection) => {
    onSectionChange(section);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton du dropdown */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ActiveIcon className="w-5 h-5" />
          <span className="text-sm font-medium">{activeItem?.label}</span>
        </div>
        <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#091626] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
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
        </div>
      )}
    </div>
  );
}
