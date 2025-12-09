'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { Gamepad2, User, LogOut, Settings } from 'lucide-react';
import MobileGameSelector from '../games/MobileGameSelector';
import SettingsModal from './SettingsModal';
import DynamicLogo from '../common/DynamicLogo';
import { Game } from '../../types';

interface NavbarProps {
  games?: Game[];
  selectedGame?: string | null;
  onGameSelectionChange?: (gameId: string | null) => void;
}

const Navbar: React.FC<NavbarProps> = ({
  games,
  selectedGame,
  onGameSelectionChange
}) => {
  const gamesList = games ?? [];

  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileGameSelectorOpen, setIsMobileGameSelectorOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { href: '/', label: mounted ? t('layout.navbar.accueil') : '' },
    { href: '/news', label: mounted ? t('layout.navbar.actualites') : '' },
    { href: '/live', label: mounted ? t('layout.navbar.direct') : '' },
    { href: '/tournois', label: mounted ? t('layout.navbar.tournois') : '' },
    { href: '/articles', label: mounted ? t('layout.navbar.articles') : '' },
    { href: '/calendrier', label: mounted ? t('layout.navbar.calendrier') : '' },
  ];

  // Détection du scroll pour changer le background de la navbar
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setScrolled(scrollPosition > 192);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Vérifier la position initiale
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const isActive = useCallback((href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  }, [pathname]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const toggleMobileGameSelector = () => {
    setIsMobileGameSelectorOpen(!isMobileGameSelectorOpen);
  };

  const closeMobileGameSelector = () => {
    setIsMobileGameSelectorOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    router.push('/');
  };

  return (
    <nav style={{
      backgroundColor: scrolled ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
      borderBottomColor: 'var(--color-border-primary)',
    }} className={`
      fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out backdrop-blur-sm border-b opacity-95
    `}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="flex items-center space-x-2 group"
          >
            <DynamicLogo
              width={200}
              height={130}
              className="h-12 w-auto group-hover:opacity-80 transition-opacity duration-300"
              priority
            />
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: isActive(link.href) ? 'var(--color-text-accent)' : 'var(--color-text-secondary)',
                }}
                className={`
                  relative px-3 py-2 text-sm font-medium transition-all duration-300 ease-out
                  hover:text-pink-400 hover:scale-105 transform-gpu
                  ${link.href === '/' ? 'hidden lg:block' : ''}
                  ${isActive(link.href)
                    ? 'font-semibold'
                    : 'hover:text-white'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Authentication Section */}
          <div className="hidden md:flex items-center space-x-2">
            {/* Admin Button - visible only for admins */}
            {isAuthenticated && user?.admin && (
              <Link
                href="/admin/stats"
                className="px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-400 rounded-lg hover:from-purple-600/90 hover:to-purple-400/90 transition-all duration-300"
              >
                Admin
              </Link>
            )}

            {/* Settings Button */}
            <div className="relative">
              <button
                onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
                style={{
                  color: 'var(--color-text-secondary)',
                }}
                className="p-2 rounded-lg hover:bg-gray-800/50 transition-all duration-300 hover:text-white"
                aria-label={t('layout.navbar.parametres')}
                title={t('layout.navbar.parametres')}
              >
                <Settings className={`w-5 h-5 transition-transform duration-500 ${isSettingsMenuOpen ? 'rotate-90' : 'rotate-0'}`} />
              </button>

              {/* Settings Modal */}
              <SettingsModal
                isOpen={isSettingsMenuOpen}
                onClose={() => setIsSettingsMenuOpen(false)}
              />
            </div>

            {isLoading ? (
              <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
            ) : isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-all duration-300"
                  style={{
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover border-2 border-pink-500"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center border-2 border-pink-500">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="font-medium text-sm">{user.name}</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--color-text-secondary)' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderColor: 'var(--color-border-primary)',
                    }} className="absolute right-0 mt-2 w-56 border rounded-lg shadow-2xl overflow-hidden z-20">
                      <div style={{ borderColor: 'var(--color-border-primary)' }} className="px-4 py-3 border-b">
                        <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">{t('layout.navbar.connecte_en_tant_que')}</p>
                        <p style={{ color: 'var(--color-text-primary)' }} className="text-sm font-medium truncate">{user.email}</p>
                      </div>
                      <div className="py-2">
                        <Link
                          href="/profile"
                          style={{ color: 'var(--color-text-secondary)' }}
                          className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-gray-800 hover:text-white transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <User className="w-4 h-4" />
                          <span>{t('layout.navbar.mon_profil')}</span>
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="cursor-pointer flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>{t('layout.navbar.se_deconnecter')}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-600 to-pink-400 rounded-lg hover:from-pink-600/90 hover:to-pink-400/90 transition-all duration-300"
              >
                {t('layout.navbar.se_connecter')}
              </Link>
            )}
          </div>

          {/* Mobile buttons */}
          <div className="md:hidden flex items-center space-x-3">
            {/* Mobile game selector button */}
            {gamesList.length > 0 && (
              <button
                type="button"
                onClick={toggleMobileGameSelector}
                style={{
                  color: 'var(--color-text-primary)',
                }}
                className="hover:text-gray-200 focus:outline-none transition-colors duration-300 p-2 rounded-lg hover:bg-gray-800/50"
                aria-label={t('layout.navbar.selectionner_un_jeu')}
              >
                <Gamepad2 className="h-6 w-6" />
              </button>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              style={{
                color: 'var(--color-text-secondary)',
              }}
              className="hover:text-white focus:outline-none transition-colors duration-300 p-2 rounded-lg hover:bg-gray-800/50"
              aria-label={t('layout.navbar.menu')}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <div style={{
        borderTopColor: 'var(--color-border-primary)',
      }} className={`
        md:hidden overflow-hidden transition-all duration-500 ease-out border-t
        ${isMobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
      `}>
          <div className="px-4 py-3 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                style={{
                  color: isActive(link.href) ? 'var(--color-text-accent)' : 'var(--color-text-secondary)',
                }}
                className={`
                  block px-3 py-3 text-base font-medium rounded-lg transition-all duration-300
                  ${isActive(link.href)
                    ? 'bg-pink-500/10 font-semibold'
                    : 'hover:text-white hover:bg-gray-800/50'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile Authentication */}
            <div style={{ borderTopColor: 'var(--color-border-primary)' }} className="pt-3 border-t">
              {isLoading ? (
                <div className="px-3 py-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
                </div>
              ) : isAuthenticated && user ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 flex items-center space-x-3">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-pink-500"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center border-2 border-pink-500">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div>
                      <p style={{ color: 'var(--color-text-primary)' }} className="text-sm font-medium">{user.name}</p>
                      <p style={{ color: 'var(--color-text-secondary)' }} className="text-xs">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    onClick={closeMobileMenu}
                    style={{ color: 'var(--color-text-secondary)' }}
                    className="flex items-center space-x-2 px-3 py-3 text-base font-medium hover:text-white hover:bg-gray-800/50 rounded-lg transition-all"
                  >
                    <User className="w-5 h-5" />
                    <span>{t('layout.navbar.mon_profil')}</span>
                  </Link>
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      handleLogout();
                    }}
                    className="flex items-center space-x-2 w-full px-3 py-3 text-base font-medium text-red-400 hover:text-red-300 hover:bg-gray-800/50 rounded-lg transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>{t('layout.navbar.se_deconnecter')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/auth/login"
                    onClick={closeMobileMenu}
                    style={{ color: 'var(--color-text-primary)' }}
                    className="block px-3 py-3 text-base font-medium hover:bg-gray-800/50 rounded-lg transition-all text-center"
                  >
                    {t('layout.navbar.se_connecter')}
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={closeMobileMenu}
                    className="block px-3 py-3 text-base font-medium text-white bg-gradient-to-r from-pink-600 to-pink-400 rounded-lg hover:from-pink-600/90 hover:to-pink-400/90 transition-all text-center"
                  >
                    {t('layout.navbar.sinscrire')}
                  </Link>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Mobile Game Selector */}
      {gamesList.length > 0 && onGameSelectionChange && (
        <MobileGameSelector
          games={gamesList}
          selectedGame={selectedGame}
          onSelectionChange={onGameSelectionChange}
          isOpen={isMobileGameSelectorOpen}
          onClose={closeMobileGameSelector}
        />
      )}
    </nav>
  );
};

export default Navbar;