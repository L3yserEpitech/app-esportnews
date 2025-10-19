import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales | EsportNews',
  description: 'Mentions légales et informations juridiques d\'EsportNews',
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#060B13] pt-20">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* En-tête */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Mentions légales
          </h1>
          <p className="text-gray-400">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

        {/* Contenu */}
        <div className="space-y-8 text-gray-300">
          {/* Section 1 - Éditeur du site */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              1. Éditeur du site
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>

          {/* Section 2 - Responsable de la publication */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              2. Responsable de la publication
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>

          {/* Section 3 - Hébergement */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              3. Hébergement
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>

          {/* Section 4 - Propriété intellectuelle */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              4. Propriété intellectuelle
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>

          {/* Section 5 - Données personnelles */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              5. Données personnelles
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>

          {/* Section 6 - Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              6. Cookies
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>

          {/* Section 7 - Responsabilité */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              7. Limitation de responsabilité
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>

          {/* Section 8 - Droit applicable */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              8. Droit applicable et juridiction
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>

          {/* Section 9 - Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              9. Contact
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="text-sm text-gray-400 italic">
                Contenu à ajouter...
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
