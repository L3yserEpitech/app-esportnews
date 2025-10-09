'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Gamepad2, User, LogOut } from 'lucide-react';
import MobileGameSelector from '../games/MobileGameSelector';
import { Game } from '../../types';

interface NavbarProps {
  games?: Game[];
  selectedGame?: string | null;
  onGameSelectionChange?: (gameId: string | null) => void;
}

const Navbar: React.FC<NavbarProps> = ({
  games = [],
  selectedGame,
  onGameSelectionChange
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileGameSelectorOpen, setIsMobileGameSelectorOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navLinks = useMemo(() => [
    { href: '/', label: 'Accueil' },
    { href: '/live', label: 'Direct' },
    { href: '/tournois', label: 'Tournois' },
    // { href: '/news', label: 'News' }, // Temporairement désactivé
    { href: '/articles', label: 'Articles' },
    { href: '/calendrier', label: 'Calendrier' },
  ], []);

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
    <nav className={`
      fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out backdrop-blur-sm
      ${scrolled
        ? 'bg-[#091626]/95 border-b border-[#182859]/40 shadow-lg'
        : 'bg-[#060B13]/95 border-b border-gray-700/40'
      }
    `}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="flex items-center space-x-2 group"
          >
            <Image
              src="/logo_blanc.png"
              alt="EsportNews"
              width={200}
              height={130}
              className="h-12 w-auto group-hover:opacity-80 transition-opacity duration-300"
              priority
            />
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  relative px-3 py-2 text-sm font-medium transition-all duration-300 ease-out
                  hover:text-pink-400 hover:scale-105 transform-gpu
                  ${isActive(link.href)
                    ? 'text-pink-400 font-semibold'
                    : 'text-gray-300 hover:text-white'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Authentication Section */}
          <div className="hidden md:flex items-center">
            {isLoading ? (
              <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
            ) : isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-all duration-300"
                >
                  {user.photo?.url ? (
                    <img
                      src={user.photo.url}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover border-2 border-pink-500"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center border-2 border-pink-500">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="text-white font-medium text-sm">{user.name}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`}
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
                    <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl overflow-hidden z-20">
                      <div className="px-4 py-3 border-b border-gray-800">
                        <p className="text-sm text-gray-400">Connecté en tant que</p>
                        <p className="text-sm font-medium text-white truncate">{user.email}</p>
                      </div>
                      <div className="py-2">
                        <Link
                          href="/profile"
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <User className="w-4 h-4" />
                          <span>Mon profil</span>
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Se déconnecter</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                {/* Temporairement désactivé */}
                {/* <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm font-medium text-white hover:text-pink-400 transition-colors"
                >
                  Se connecter
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-600 to-pink-400 rounded-lg hover:from-pink-600/90 hover:to-pink-400/90 transition-all duration-300"
                >
                  S'inscrire
                </Link> */}
              </div>
            )}
          </div>

          {/* Mobile buttons */}
          <div className="md:hidden flex items-center space-x-3">
            {/* Mobile game selector button */}
            {games.length > 0 && (
              <button
                type="button"
                onClick={toggleMobileGameSelector}
                className="text-white hover:text-gray-200 focus:outline-none focus:text-gray-200 transition-colors duration-300 p-2 rounded-lg hover:bg-gray-800/50"
                aria-label="Sélectionner un jeu"
              >
                <Gamepad2 className="h-6 w-6" />
              </button>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="text-gray-300 hover:text-white focus:outline-none focus:text-white transition-colors duration-300 p-2 rounded-lg hover:bg-gray-800/50"
              aria-label="Menu"
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
      <div className={`
        md:hidden overflow-hidden transition-all duration-500 ease-out
        ${scrolled
          ? 'border-t border-[#182859]/40'
          : 'border-t border-gray-700/40'
        }
        ${isMobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
      `}>
          <div className="px-4 py-3 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className={`
                  block px-3 py-3 text-base font-medium rounded-lg transition-all duration-300
                  ${isActive(link.href)
                    ? 'text-pink-400 bg-pink-500/10 font-semibold'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile Authentication */}
            <div className="pt-3 border-t border-gray-700/40">
              {isLoading ? (
                <div className="px-3 py-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
                </div>
              ) : isAuthenticated && user ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 flex items-center space-x-3">
                    {user.photo?.url ? (
                      <img
                        src={user.photo.url}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-pink-500"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center border-2 border-pink-500">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    onClick={closeMobileMenu}
                    className="flex items-center space-x-2 px-3 py-3 text-base font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all"
                  >
                    <User className="w-5 h-5" />
                    <span>Mon profil</span>
                  </Link>
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      handleLogout();
                    }}
                    className="flex items-center space-x-2 w-full px-3 py-3 text-base font-medium text-red-400 hover:text-red-300 hover:bg-gray-800/50 rounded-lg transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Temporairement désactivé */}
                  {/* <Link
                    href="/auth/login"
                    onClick={closeMobileMenu}
                    className="block px-3 py-3 text-base font-medium text-white hover:bg-gray-800/50 rounded-lg transition-all text-center"
                  >
                    Se connecter
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={closeMobileMenu}
                    className="block px-3 py-3 text-base font-medium text-white bg-gradient-to-r from-pink-600 to-pink-400 rounded-lg hover:from-pink-600/90 hover:to-pink-400/90 transition-all text-center"
                  >
                    S'inscrire
                  </Link> */}
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Mobile Game Selector */}
      {games.length > 0 && onGameSelectionChange && (
        <MobileGameSelector
          games={games}
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