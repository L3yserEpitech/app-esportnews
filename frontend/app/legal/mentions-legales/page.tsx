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
            Mentions légales — Esport News
          </h1>
          <p className="text-gray-400">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

        {/* Contenu */}
        <div className="space-y-8 text-gray-300">
          {/* Éditeur du site */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Éditeur du site
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-2">
              <p><strong className="text-white">Dénomination sociale :</strong> ESPORT NEWS</p>
              <p><strong className="text-white">Forme juridique :</strong> Société par Actions Simplifiée (SAS)</p>
              <p><strong className="text-white">Capital social :</strong> 1 000,00 €</p>
              <p><strong className="text-white">Siège social :</strong> 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France</p>
              <p><strong className="text-white">SIRET :</strong> 987 953 247</p>
              <p><strong className="text-white">SIREN :</strong> 98795324700010</p>
              <p><strong className="text-white">N° TVA intracommunautaire :</strong> FR18987953247</p>
              <p><strong className="text-white">Email :</strong> <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a></p>
              <div className="mt-4 pt-4 border-t border-[#182859]/30">
                <p><strong className="text-white">Directeur de la publication :</strong> Parnasse édition</p>
                <p><strong className="text-white">Directeur de la rédaction :</strong> Kenan ALTARAC</p>
                <p><strong className="text-white">Directeur du pôle numérique :</strong> Samuel COHEN</p>
              </div>
            </div>
          </section>

          {/* Hébergeur */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Hébergeur
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <p className="font-semibold text-white mb-1">Site web (frontend) :</p>
                <p>Hébergé par <strong className="text-white">Vercel Inc.</strong></p>
                <p className="text-sm text-gray-400 mt-1">440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-[#F22E62] hover:underline">vercel.com</a></p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Serveur applicatif (backend) :</p>
                <p>Hébergé par <strong className="text-white">Railway Corporation</strong></p>
                <p className="text-sm text-gray-400 mt-1">San Francisco, CA, États-Unis — <a href="https://railway.app" target="_blank" rel="noopener noreferrer" className="text-[#F22E62] hover:underline">railway.app</a></p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Base de données :</p>
                <p>Hébergée par <strong className="text-white">Supabase Inc.</strong></p>
                <p className="text-sm text-gray-400 mt-1">San Francisco, CA, États-Unis — <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-[#F22E62] hover:underline">supabase.com</a></p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Application mobile :</p>
                <p>Distribuée via l'<strong className="text-white">App Store</strong> (Apple Inc.) et le <strong className="text-white">Google Play Store</strong> (Google LLC).</p>
              </div>
              <p className="text-sm text-gray-400 mt-2 pt-2 border-t border-[#182859]/30">Les transferts de données hors UE sont encadrés par des garanties appropriées (Clauses Contractuelles Types de la Commission européenne).</p>
            </div>
          </section>

          {/* Périmètre des « Supports Esport News » */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Périmètre des « Supports Esport News »
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Les « Supports Esport News » regroupent : le site esportnews.fr (desktop et mobile), l'application mobile iOS/Android, les newsletters, les notifications push, ainsi que, le cas échéant, les flux (ex. RSS) et autres services éditoriaux.</p>
              <p className="mt-2">Sauf autorisation écrite préalable, l'accès est limité à un usage personnel, privé et non commercial.</p>
            </div>
          </section>

          {/* Propriété intellectuelle & bases de données */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Propriété intellectuelle &amp; bases de données
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>L'ensemble des contenus des Supports Esport News (textes, images, logos, vidéos, marques, scores, calendriers, statistiques, données, flux, bases de données, codes et structures) est protégé par les législations applicables.</p>
              <p className="mt-2">Toute reproduction, représentation, extraction (y compris extraction substantielle ou répétée de bases de données), agrégation, indexation massive ou réutilisation sans autorisation écrite d'Esport News est interdite.</p>
            </div>
          </section>

          {/* Contenus en direct, scores & statistiques */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Contenus en direct, scores &amp; statistiques
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Esport News diffuse des fils en direct, résultats, scores et statistiques, susceptibles de provenir de tiers (organisateurs, data providers).</p>
              <p className="mt-2">Nous veillons à leur fiabilité, mais l'exactitude, l'exhaustivité et la disponibilité en continu ne sont pas garanties. Toute réexploitation externe (API, scraping, republication de flux/scores) nécessite une autorisation écrite préalable.</p>
            </div>
          </section>

          {/* Application mobile & notifications (push) */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Application mobile &amp; notifications (push)
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Sous réserve de votre consentement, l'application Esport News peut émettre des notifications (actualités, résultats, directs, enquêtes).</p>
              <p className="mt-2">Vous pouvez retirer votre consentement à tout moment dans les réglages du système (iOS/Android) ou du navigateur (pour les web push).</p>
            </div>
          </section>

          {/* Services tiers, intégrations & liens externes */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Services tiers, intégrations &amp; liens externes
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Certains modules (lecteurs vidéo, statistiques enrichies, billetterie, boutons de partage, mesure d'audience, monétisation) sont fournis par des tiers. Leur utilisation implique l'acceptation des conditions et politiques de ces partenaires, sous leur seule responsabilité.</p>
              <p className="mt-2">Esport News n'est pas responsable des contenus, de la disponibilité ou des dommages liés à ces services ou aux liens sortants.</p>
            </div>
          </section>

          {/* Liens et contenus externes */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Liens et contenus externes
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Le site peut contenir des liens vers des sites tiers. Esport News n'est pas responsable de leur contenu ni de leurs pratiques. L'éditeur s'efforce d'assurer l'exactitude des informations publiées, sans garantie d'exhaustivité ou d'absence d'erreurs.</p>
            </div>
          </section>

          {/* Données personnelles (RGPD) */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Données personnelles (RGPD)
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <div>
                <p><strong className="text-white">Responsable de traitement :</strong> Esport News SAS.</p>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Finalités :</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Gestion du site et de l'app</li>
                  <li>Gestion des comptes et du support</li>
                  <li>Mesure d'audience et amélioration du service</li>
                  <li>Notifications/push, newsletters et communications marketing</li>
                  <li>Relations commerciales/abonnements/facturation</li>
                  <li>Gestion des concours et événements</li>
                  <li>Sécurité et prévention de la fraude</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Bases légales :</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Exécution du contrat (ex. création/gestion du compte, abonnement, participation à un concours)</li>
                  <li>Intérêt légitime (bon fonctionnement, sécurité, statistiques essentielles)</li>
                  <li>Consentement (ex. newsletters, notifications, cookies/traceurs non essentiels)</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Données traitées :</p>
                <p className="text-sm">Identité (nom, prénom, pseudo), coordonnées (e-mail, téléphone), identifiants et données de connexion, préférences, données de transaction/abonnement, contenus/participations (commentaires, concours), échanges avec le support, données techniques et logs (adresse IP, appareil, navigateur, OS), données d'usage, cookies/traceurs et identifiants publicitaires.</p>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Durées de conservation :</p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
                  <li>Données de compte pendant la relation, puis 3 ans à compter du dernier contact pour la prospection</li>
                  <li>Pièces comptables/factures : 10 ans</li>
                  <li>Prospection (e-mail/push) : jusqu'au retrait du consentement ou 3 ans après le dernier contact</li>
                  <li>Logs de sécurité : 12 mois</li>
                  <li>Données liées aux concours : pendant la durée de l'opération + 6 mois</li>
                  <li>Cookies/traceurs selon leur finalité (audience non essentielle ≤ 13 mois ; preuve du consentement 6 à 13 mois)</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Destinataires :</p>
                <p className="text-sm">Équipes internes habilitées ; prestataires techniques (hébergement, maintenance, e-mail/SMS, push, analytics, paiement) ; le cas échéant régies/partenaires publicitaires et prestataires logistiques d'événements ; autorités légalement habilitées.</p>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Transferts hors UE :</p>
                <p className="text-sm">Le cas échéant, mis en œuvre avec des garanties appropriées (Clauses Contractuelles Types de la Commission européenne et mesures complémentaires).</p>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Vos droits :</p>
                <p className="text-sm">Accès, rectification, effacement, opposition (dont à la prospection), limitation, portabilité, directives post-mortem.</p>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Exercice des droits :</p>
                <p className="text-sm"><a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a> ou courrier à 15 rue d'Estienne d'Orves, Charenton-le-Pont.</p>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">Réclamation :</p>
                <p className="text-sm">CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[#F22E62] hover:underline">cnil.fr</a>).</p>
              </div>

              <div className="pt-3 border-t border-[#182859]/30">
                <p className="text-sm">Pour le détail, voir notre <a href="/politique-confidentialite" className="text-[#F22E62] hover:underline">Politique de confidentialité</a>.</p>
                <p className="text-sm mt-1">Cookies : vous pouvez paramétrer vos choix à tout moment via « Paramètres cookies ».</p>
              </div>
            </div>
          </section>

          {/* Cookies & traceurs */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Cookies &amp; traceurs
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Lors de votre visite, des cookies/traceurs peuvent être déposés pour le fonctionnement du site, la mesure d'audience et la personnalisation/publicité.</p>
              <p className="mt-2">Vous pouvez paramétrer votre consentement à tout moment via le Gestionnaire de cookies.</p>
              <p className="mt-2">Plus d'informations : <a href="/legal/cookies" className="text-[#F22E62] hover:underline">Politique Cookies</a>.</p>
            </div>
          </section>

          {/* Newsletter & prospection */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Newsletter &amp; prospection
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Vous pouvez vous désabonner à tout moment via le lien présent dans chaque email ou en nous écrivant.</p>
            </div>
          </section>

          {/* Responsabilité & disponibilité */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Responsabilité &amp; disponibilité
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Nous mettons tout en œuvre pour assurer un service accessible et sécurisé. L'accès peut toutefois être interrompu ou limité (maintenance, mises à jour, incidents réseau/tiers).</p>
              <p className="mt-2">Esport News ne saurait être tenue responsable des préjudices indirects, pertes de données ou manque à gagner liés à l'utilisation des Supports.</p>
            </div>
          </section>

          {/* Droit applicable */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Droit applicable
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Le présent site est régi par le droit français. Les juridictions compétentes sont celles du ressort de Créteil, sauf dispositions impératives contraires.</p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Contact
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>Pour toute question : <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
