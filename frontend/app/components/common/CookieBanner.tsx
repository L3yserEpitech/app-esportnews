'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà accepté les cookies
    const cookieConsent = localStorage.getItem('esportnews_cookie_consent');

    if (!cookieConsent) {
      // Afficher la bannière après un court délai (pour ne pas être trop intrusif)
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('esportnews_cookie_consent', 'accepted');
    localStorage.setItem('esportnews_cookie_consent_date', new Date().toISOString());
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-slide-up">
      <div className="container mx-auto max-w-6xl">
        <div className="bg-[#091626] border border-[#182859] rounded-lg shadow-2xl p-6 md:flex md:items-center md:justify-between gap-6">
          {/* Texte */}
          <div className="flex-1 mb-4 md:mb-0">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🍪</div>
              <div>
                <h3 className="text-white font-semibold mb-2 text-lg">
                  Cookies & Confidentialité
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Ce site utilise uniquement des <strong className="text-white">cookies techniques strictement nécessaires</strong> à son fonctionnement (authentification, préférences).{' '}
                  <strong className="text-white">Aucun cookie publicitaire tiers</strong> n'est utilisé.
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  En continuant à naviguer, vous acceptez l'utilisation de ces cookies techniques.{' '}
                  <Link href="/legal/cookies" className="text-[#F22E62] hover:underline">
                    En savoir plus
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex flex-col sm:flex-row gap-3 md:flex-shrink-0">
            <Link
              href="/legal/cookies"
              className="px-4 py-2 bg-[#182859] hover:bg-[#182859]/80 text-white text-sm font-medium rounded-lg transition-colors duration-200 text-center border border-[#182859]"
            >
              En savoir plus
            </Link>
            <button
              onClick={handleAccept}
              className="px-6 py-2 bg-[#F22E62] hover:bg-[#d92556] text-white text-sm font-semibold rounded-lg transition-colors duration-200 shadow-lg"
            >
              J'ai compris
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
