import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              <span className="text-pink-500">Esport</span>News
            </h3>
            <p className="text-gray-400 text-sm">
              Votre source d'actualités esport et de suivi des matchs en direct.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-white mb-3">Navigation</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/live" className="hover:text-white transition-colors">Matchs en Direct</Link></li>
              <li><Link href="/tournois" className="hover:text-white transition-colors">Tournois</Link></li>
              <li><Link href="/news" className="hover:text-white transition-colors">Actualités</Link></li>
              <li><Link href="/calendrier" className="hover:text-white transition-colors">Calendrier</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-3">Jeux</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/valorant" className="hover:text-white transition-colors">Valorant</Link></li>
              <li><Link href="/cs2" className="hover:text-white transition-colors">CS2</Link></li>
              <li><Link href="/lol" className="hover:text-white transition-colors">League of Legends</Link></li>
              <li><Link href="/dota" className="hover:text-white transition-colors">Dota 2</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-3">Légal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</Link></li>
              <li><Link href="/politique-confidentialite" className="hover:text-white transition-colors">Politique de confidentialité</Link></li>
              <li><Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
          &copy; 2024 EsportNews. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}