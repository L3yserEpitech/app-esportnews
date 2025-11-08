import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#060B13] border-t border-[#182859]/30">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Logo et description */}
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              <Image
                src="/logo_blanc.png"
                alt="EsportNews Logo"
                width={180}
                height={60}
                className="h-12 w-auto"
              />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              {t('layout.footer.description')}
            </p>
          </div>

          {/* Réseaux sociaux */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-base">{t('layout.footer.suivez_nous')}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://www.instagram.com/esportnewsfr?igsh=MXU3emV0cjZ6ZG9tMg%3D%3D&utm_source=qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/esportnews_off?s=21&t=TUQ72qaoDYyvK9Drw0iIXg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X (Twitter)
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/esportnews"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-base">{t('layout.footer.navigation')}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/" className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200">
                  {t('layout.navbar.accueil')}
                </Link>
              </li>
              <li>
                <Link href="/live" className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200">
                  {t('layout.footer.matchs_en_direct')}
                </Link>
              </li>
              <li>
                <Link href="/tournois" className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200">
                  {t('layout.navbar.tournois')}
                </Link>
              </li>
              <li>
                <Link href="/news" className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200">
                  {t('layout.navbar.actualites')}
                </Link>
              </li>
              <li>
                <Link href="/articles" className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200">
                  {t('layout.navbar.articles')}
                </Link>
              </li>
              <li>
                <Link href="/calendrier" className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200">
                  {t('layout.navbar.calendrier')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Informations légales */}
          <div className="flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-white mb-4 text-base">{t('layout.footer.informations_legales')}</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/legal/mentions-legales" className="text-gray-400 hover:text-[#F22E62] transition-colors duration-200">
                    {t('layout.footer.mentions_legales')}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Kit média */}
            <div className="mt-6">
              <h4 className="font-semibold text-white mb-4 text-base">{t('layout.footer.kit_media')}</h4>
              <a
                href="/Kit Média ESPORT NEWS.pdf"
                download="Kit_Media_ESPORT_NEWS.pdf"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#F22E62] hover:bg-[#d92556] text-white text-sm font-medium rounded-lg transition-colors duration-200"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {t('layout.footer.telecharger_kit_media')}
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-[#182859]/30 mt-12 pt-8">
          <p className="text-sm text-gray-500 text-center">
            &copy; {year} EsportNews. {t('layout.footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
