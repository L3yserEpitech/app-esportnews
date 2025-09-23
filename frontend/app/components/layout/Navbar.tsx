'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import UserProfile from '../auth/UserProfile';
import LoginButton from '../auth/LoginButton';

const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = useMemo(() => [
    { href: '/', label: 'Accueil' },
    { href: '/direct', label: 'Direct' },
    { href: '/tournois', label: 'Tournois' },
    { href: '/news', label: 'News' },
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
            <div className="text-2xl font-bold text-white group-hover:text-gray-200 transition-all duration-300">
              EsportNews
            </div>
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
            {status === 'loading' ? (
              <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
            ) : session ? (
              <UserProfile />
            ) : (
              <LoginButton />
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="text-gray-300 hover:text-white focus:outline-none focus:text-white transition-colors duration-300"
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
        ${isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
      `}>
          <div className="px-4 py-3 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className={`
                  block px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300
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
              {status === 'loading' ? (
                <div className="px-3 py-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
                </div>
              ) : session ? (
                <div className="px-3 py-2">
                  <UserProfile />
                </div>
              ) : (
                <div className="px-3 py-2">
                  <LoginButton className="w-full" />
                </div>
              )}
            </div>
          </div>
      </div>
    </nav>
  );
};

export default Navbar;