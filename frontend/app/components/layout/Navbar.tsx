'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

const Navbar: React.FC = () => {
  const pathname = usePathname();

  const navLinks = useMemo(() => [
    { href: '/', label: 'Accueil' },
    { href: '/direct', label: 'Direct' },
    { href: '/tournois', label: 'Tournois' },
    { href: '/news', label: 'News' },
    { href: '/articles', label: 'Articles' },
    { href: '/calendrier', label: 'Calendrier' },
  ], []);

  const isActive = useCallback((href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="flex items-center space-x-2 group"
          >
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-500 bg-clip-text text-transparent group-hover:from-pink-300 group-hover:to-purple-400 transition-all duration-300">
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

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              className="text-gray-300 hover:text-white focus:outline-none focus:text-white transition-colors duration-300"
              aria-label="Menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation - Simple version for now */}
      <div className="md:hidden border-t border-gray-700/40">
        <div className="px-4 py-3 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
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
        </div>
      </div>
    </nav>
  );
};

export default Navbar;