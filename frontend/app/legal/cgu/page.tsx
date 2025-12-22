import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation | EsportNews',
  description: 'Conditions d\'utilisation de la plateforme ESPORT NEWS',
};

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-[#060B13] pt-20">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* En-tête */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Conditions Générales d'Utilisation (CGU)
          </h1>
          <p className="text-gray-400">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
          <p className="text-gray-300 mt-4">
            Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de la plateforme ESPORT NEWS, accessible via le site web <strong className="text-white">www.esportnews.fr</strong> et l'application mobile iOS/Android.
          </p>
        </div>

        {/* Contenu */}
        <div className="space-y-8 text-gray-300">
          {/* Article 1 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 1 - Objet
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS est une plateforme d'actualités et d'informations dédiée à l'esport, proposant :</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Le suivi en temps réel des matchs esport en direct (multi-jeux)</li>
                <li>Des actualités et articles éditoriaux sur l'esport</li>
                <li>Des informations sur les tournois, équipes et compétitions</li>
                <li>Un calendrier des matchs à venir</li>
                <li>Des fonctionnalités de personnalisation (équipes favorites, notifications)</li>
              </ul>
              <p className="mt-4">
                L'utilisation de la plateforme implique l'acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.
              </p>
            </div>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 2 - Éditeur de la plateforme
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-2">
              <p><strong className="text-white">Dénomination sociale :</strong> ESPORT NEWS</p>
              <p><strong className="text-white">Forme juridique :</strong> Société par Actions Simplifiée (SAS)</p>
              <p><strong className="text-white">Capital social :</strong> 1 000,00 €</p>
              <p><strong className="text-white">Siège social :</strong> 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France</p>
              <p><strong className="text-white">SIRET :</strong> 987 953 247 | <strong className="text-white">SIREN :</strong> 98795324700010</p>
              <p><strong className="text-white">Email :</strong> <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a></p>
            </div>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 3 - Accès à la plateforme
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.1 Accès gratuit</h3>
                <p>La majorité des contenus d'ESPORT NEWS est accessible gratuitement, sans inscription obligatoire.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.2 Création de compte</h3>
                <p>Certaines fonctionnalités nécessitent la création d'un compte utilisateur (équipes favorites, notifications personnalisées). La création de compte est gratuite.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Conditions : avoir au moins 13 ans, fournir des informations exactes et à jour.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.3 Disponibilité</h3>
                <p>ESPORT NEWS s'efforce d'assurer l'accessibilité de la plateforme 24h/24, 7j/7, mais ne garantit pas une disponibilité continue (maintenance, mises à jour, incidents techniques).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.4 Prérequis techniques</h3>
                <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
                  <li>Navigateur web récent (Chrome, Firefox, Safari, Edge)</li>
                  <li>Connexion internet stable</li>
                  <li>Pour l'application mobile : iOS 13+ ou Android 8.0+</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 4 - Création et gestion du compte utilisateur
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.1 Inscription</h3>
                <p>Pour créer un compte, vous devez fournir :</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Nom et prénom</li>
                  <li>Adresse email valide (identifiant unique)</li>
                  <li>Mot de passe sécurisé</li>
                  <li>Date de naissance (vérification de l'âge minimum)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.2 Responsabilité du compte</h3>
                <p>Vous êtes seul responsable de la confidentialité de vos identifiants de connexion. Toute utilisation de votre compte est présumée effectuée par vous.</p>
                <p className="text-sm text-gray-400 mt-2">
                  En cas d'utilisation frauduleuse ou de vol de compte, contactez immédiatement <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a>.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.3 Exactitude des informations</h3>
                <p>Vous vous engagez à fournir des informations exactes, complètes et à jour. ESPORT NEWS se réserve le droit de suspendre ou supprimer tout compte créé avec des informations fausses ou frauduleuses.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.4 Un compte par personne</h3>
                <p>La création de comptes multiples par une même personne est interdite, sauf autorisation écrite d'ESPORT NEWS.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.5 Suppression de compte</h3>
                <p>Vous pouvez supprimer votre compte à tout moment depuis votre profil utilisateur. La suppression entraîne l'effacement définitif de vos données personnelles (sauf obligations légales de conservation).</p>
              </div>
            </div>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 5 - Utilisation acceptable de la plateforme
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <p>En utilisant ESPORT NEWS, vous vous engagez à :</p>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">5.1 Comportement interdit</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Ne pas utiliser la plateforme à des fins illégales ou frauduleuses</li>
                  <li>Ne pas tenter d'accéder aux comptes d'autres utilisateurs</li>
                  <li>Ne pas collecter ou extraire massivement des données (scraping, crawling non autorisé)</li>
                  <li>Ne pas contourner les mesures de sécurité</li>
                  <li>Ne pas propager de virus, malwares ou codes malveillants</li>
                  <li>Ne pas usurper l'identité d'une autre personne ou entité</li>
                  <li>Ne pas publier de contenu diffamatoire, injurieux, raciste, discriminatoire ou illégal</li>
                  <li>Ne pas spammer ou envoyer des communications non sollicitées</li>
                  <li>Ne pas créer de comptes automatisés (bots)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">5.2 Sanctions</h3>
                <p>En cas de non-respect de ces règles, ESPORT NEWS se réserve le droit de :</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Émettre un avertissement</li>
                  <li>Suspendre temporairement votre compte</li>
                  <li>Supprimer définitivement votre compte</li>
                  <li>Engager des poursuites judiciaires si nécessaire</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 6 - Propriété intellectuelle
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.1 Contenus protégés</h3>
                <p>Tous les contenus présents sur la plateforme ESPORT NEWS sont protégés par le droit d'auteur et le droit des bases de données :</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Articles éditoriaux (textes, titres, descriptions)</li>
                  <li>Images, photographies, vidéos</li>
                  <li>Logo et marque ESPORT NEWS</li>
                  <li>Design et interface utilisateur</li>
                  <li>Code source de la plateforme</li>
                  <li>Bases de données (tournois, matchs, équipes)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.2 Droits d'utilisation accordés</h3>
                <p>L'utilisation de la plateforme vous confère uniquement un droit d'accès personnel, privé et non commercial aux contenus.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Vous pouvez consulter et partager les contenus via les fonctionnalités natives (boutons de partage), mais toute reproduction, représentation, extraction ou réutilisation à des fins commerciales est strictement interdite sans autorisation écrite préalable.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.3 Contenus de tiers</h3>
                <p>Certains contenus (images d'équipes, logos de jeux, vidéos de matchs) appartiennent à des tiers (éditeurs de jeux, organisateurs de tournois, équipes esport).</p>
                <p className="text-sm text-gray-400 mt-2">
                  ESPORT NEWS utilise ces contenus dans le cadre du droit de citation et d'information. Les crédits sont systématiquement indiqués lorsque requis.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.4 Signalement d'infraction</h3>
                <p>Si vous estimez qu'un contenu porte atteinte à vos droits de propriété intellectuelle, contactez-nous à <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a> avec :</p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
                  <li>Identification précise du contenu litigieux (URL)</li>
                  <li>Preuve de votre titularité des droits</li>
                  <li>Vos coordonnées complètes</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 7 - Données de matchs et informations tierces
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">7.1 Fournisseurs de données</h3>
                <p>ESPORT NEWS agrège des données provenant de sources tierces :</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li><strong className="text-white">PandaScore :</strong> Tournois, matchs, équipes, statistiques</li>
                  <li><strong className="text-white">SportDevs :</strong> Matchs en direct, actualités esport</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">7.2 Exactitude des informations</h3>
                <p>ESPORT NEWS s'efforce d'assurer l'exactitude et la fiabilité des informations affichées, mais ne peut garantir leur exhaustivité ou leur absence d'erreurs.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Les horaires de matchs, résultats et classements sont fournis à titre indicatif. ESPORT NEWS ne saurait être tenue responsable des erreurs ou omissions provenant de sources tierces.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">7.3 Liens externes (streams)</h3>
                <p>La plateforme propose des liens vers des diffusions en direct (Twitch, YouTube, etc.). Ces liens s'ouvrent dans un nouvel onglet et vous redirigent vers des plateformes tierces.</p>
                <p className="text-sm text-gray-400 mt-2">
                  ESPORT NEWS n'est pas responsable du contenu de ces streams ni des conditions d'utilisation des plateformes tierces.
                </p>
              </div>
            </div>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 8 - Publicités
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">8.1 Publicités internes</h3>
                <p>ESPORT NEWS affiche des bannières publicitaires gérées en interne (sans régies publicitaires tierces type Google AdSense ou Meta Ads).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">8.2 Affichage des publicités</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li><strong className="text-white">Version desktop :</strong> Colonne publicitaire visible pour tous les utilisateurs (y compris abonnés Premium)</li>
                  <li><strong className="text-white">Version mobile :</strong> Popups publicitaires désactivés pour les abonnés Premium uniquement</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">8.3 Aucun tracking publicitaire</h3>
                <p className="text-sm text-gray-400">
                  ✅ Aucun cookie publicitaire tiers<br />
                  ✅ Aucun tracking comportemental<br />
                  ✅ Affichage simple d'images/vidéos fournies par des partenaires commerciaux
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">8.4 Responsabilité</h3>
                <p className="text-sm">ESPORT NEWS n'est pas responsable du contenu des publicités ni des sites web vers lesquels elles redirigent.</p>
              </div>
            </div>
          </section>

          {/* Article 9 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 9 - Données personnelles
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>La collecte, le traitement et la protection de vos données personnelles sont régis par notre <a href="/legal/politique-confidentialite" className="text-[#F22E62] hover:underline">Politique de Confidentialité</a>, conforme au RGPD.</p>

              <p className="mt-3">En utilisant ESPORT NEWS, vous acceptez les traitements de données décrits dans cette politique.</p>

              <p className="text-sm text-gray-400 mt-3">
                Vous disposez de droits sur vos données (accès, rectification, suppression, portabilité, opposition). Pour les exercer, consultez la section « Vos droits » de notre Politique de Confidentialité.
              </p>
            </div>
          </section>

          {/* Article 10 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 10 - Limitation de responsabilité
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">10.1 Disponibilité du service</h3>
                <p>ESPORT NEWS ne garantit pas une disponibilité ininterrompue de la plateforme. Le service peut être suspendu pour maintenance, mises à jour ou incidents techniques.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">10.2 Exactitude des contenus</h3>
                <p>ESPORT NEWS s'efforce de fournir des informations exactes et à jour, mais ne peut être tenue responsable des erreurs, omissions ou inexactitudes dans les contenus (horaires, résultats, classements).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">10.3 Contenus et services tiers</h3>
                <p>ESPORT NEWS n'est pas responsable des contenus, produits ou services proposés par des tiers via des liens externes ou intégrations (streams, publicités, APIs).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">10.4 Préjudices indirects</h3>
                <p>ESPORT NEWS ne saurait être tenue responsable des préjudices indirects, pertes de données, manque à gagner ou dommages résultant de l'utilisation ou de l'impossibilité d'utiliser la plateforme.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">10.5 Force majeure</h3>
                <p className="text-sm text-gray-400">ESPORT NEWS ne peut être tenue responsable de l'inexécution de ses obligations en cas de force majeure (catastrophe naturelle, panne généralisée d'internet, acte de guerre, etc.).</p>
              </div>
            </div>
          </section>

          {/* Article 11 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 11 - Modification des CGU
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS se réserve le droit de modifier les présentes CGU à tout moment.</p>

              <p className="mt-3">Toute modification substantielle sera notifiée aux utilisateurs inscrits par email ou notification sur la plateforme, au moins <strong className="text-white">30 jours avant</strong> son entrée en vigueur.</p>

              <p className="text-sm text-gray-400 mt-3">
                La poursuite de l'utilisation de la plateforme après modification vaut acceptation des nouvelles CGU. Si vous n'acceptez pas les modifications, vous devez cesser d'utiliser la plateforme.
              </p>
            </div>
          </section>

          {/* Article 12 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 12 - Droit applicable et juridiction compétente
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Les présentes CGU sont régies par le <strong className="text-white">droit français</strong>.</p>

              <p className="mt-3">
                Tout litige relatif à l'interprétation ou à l'exécution des présentes sera soumis aux <strong className="text-white">juridictions compétentes du ressort de Créteil</strong>, sauf dispositions impératives contraires (notamment pour les consommateurs résidant dans l'Union Européenne).
              </p>

              <div className="mt-4 pt-4 border-t border-[#182859]/30">
                <h3 className="text-lg font-semibold text-white mb-2">Médiation pour les consommateurs</h3>
                <p className="text-sm">
                  Conformément à l'article L.612-1 du Code de la consommation, en cas de litige, vous pouvez recourir gratuitement à un médiateur de la consommation avant toute action en justice.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Médiateur recommandé : [À compléter si applicable]
                </p>
              </div>
            </div>
          </section>

          {/* Article 13 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 13 - Contact
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Pour toute question concernant les présentes CGU :</p>

              <div className="mt-4 space-y-2">
                <p>
                  <strong className="text-white">Email :</strong> <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a>
                </p>
                <p>
                  <strong className="text-white">Courrier :</strong> ESPORT NEWS, 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France
                </p>
              </div>
            </div>
          </section>

          {/* Footer CGU */}
          <section className="mt-12 pt-8 border-t border-[#182859]/30">
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-400">
                En utilisant la plateforme ESPORT NEWS, vous reconnaissez avoir lu, compris et accepté les présentes Conditions Générales d'Utilisation.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
