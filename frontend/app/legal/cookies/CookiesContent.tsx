'use client';

import { useEffect, useState } from 'react';

export default function CookiesContent() {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('fr-FR'));
  }, []);

  const handleOpenCookiePreferences = () => {
    // TODO: Implémenter l'ouverture de la CMP (Consent Management Platform)
    console.log('Ouvrir le panneau de gestion des cookies');
  };

  return (
    <div className="min-h-screen bg-[#060B13] pt-20">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* En-tête */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Politique de gestion des cookies
          </h1>
          <p className="text-gray-400">
            Dernière mise à jour : {currentDate || 'Chargement...'}
          </p>
        </div>

        {/* Contenu */}
        <div className="space-y-8 text-gray-300">

          {/* Introduction */}
          <section>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="mb-4">
                EsportNews utilise des cookies et technologies similaires pour vous offrir la meilleure expérience possible lors de votre navigation sur notre plateforme e-sport.
              </p>
              <p>
                Cette page vous explique ce que sont les cookies, comment nous les utilisons, et comment vous pouvez gérer vos préférences.
              </p>
            </div>
          </section>

          {/* Section 1 - Qu'est-ce qu'un cookie */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              1. Qu'est-ce qu'un cookie ?
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <p>
                Un cookie est un petit fichier texte stocké sur votre appareil (ordinateur, tablette, smartphone) lorsque vous visitez un site web. Il permet au site de mémoriser vos actions et préférences pendant une certaine période.
              </p>
              <p>
                Les cookies peuvent être :
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Cookies de session</strong> : supprimés automatiquement lorsque vous fermez votre navigateur</li>
                <li><strong className="text-white">Cookies persistants</strong> : restent sur votre appareil pendant une durée définie</li>
                <li><strong className="text-white">Cookies first-party</strong> : déposés par EsportNews directement</li>
                <li><strong className="text-white">Cookies third-party</strong> : déposés par nos partenaires (régies publicitaires, analytics)</li>
              </ul>
            </div>
          </section>

          {/* Section 2 - Catégories de cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              2. Quels cookies utilisons-nous ?
            </h2>

            {/* Cookies strictement nécessaires */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Cookies strictement nécessaires
              </h3>
              <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
                <p className="text-sm bg-[#182859]/20 border border-[#182859] rounded px-3 py-2 text-gray-300">
                  Ces cookies sont indispensables au fonctionnement du site. Ils ne peuvent pas être désactivés dans nos systèmes. Ils sont généralement établis en réponse à des actions que vous effectuez (connexion, préférences de confidentialité, etc.).
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[#182859]">
                      <tr className="text-left">
                        <th className="py-3 px-4 text-white font-semibold">Nom du cookie</th>
                        <th className="py-3 px-4 text-white font-semibold">Finalité</th>
                        <th className="py-3 px-4 text-white font-semibold">Durée</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182859]/30">
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">auth_token</td>
                        <td className="py-3 px-4">Maintien de votre session utilisateur authentifiée</td>
                        <td className="py-3 px-4 text-gray-400">Session</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">cmp_consent</td>
                        <td className="py-3 px-4">Mémorisation de vos choix en matière de cookies</td>
                        <td className="py-3 px-4 text-gray-400">12 mois</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">csrf_token</td>
                        <td className="py-3 px-4">Protection contre les attaques CSRF (sécurité)</td>
                        <td className="py-3 px-4 text-gray-400">Session</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">subscription_status</td>
                        <td className="py-3 px-4">Identification de votre statut d'abonnement (affichage/masquage publicités)</td>
                        <td className="py-3 px-4 text-gray-400">30 jours</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Cookies de performance */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-blue-400">📊</span>
                Cookies de performance et analytics
              </h3>
              <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
                <p className="text-sm bg-[#182859]/20 border border-[#182859] rounded px-3 py-2 text-gray-300">
                  Ces cookies nous permettent de mesurer l'audience, d'analyser les performances du site et de comprendre comment vous interagissez avec notre plateforme. Ils nous aident à améliorer continuellement votre expérience.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[#182859]">
                      <tr className="text-left">
                        <th className="py-3 px-4 text-white font-semibold">Nom du cookie</th>
                        <th className="py-3 px-4 text-white font-semibold">Finalité</th>
                        <th className="py-3 px-4 text-white font-semibold">Tiers</th>
                        <th className="py-3 px-4 text-white font-semibold">Durée</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182859]/30">
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">__v_*</td>
                        <td className="py-3 px-4">Mesure des performances et comportement utilisateur (anonymisé)</td>
                        <td className="py-3 px-4 text-gray-400">Vercel Analytics</td>
                        <td className="py-3 px-4 text-gray-400">Session</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">analytics_events</td>
                        <td className="py-3 px-4">Suivi des interactions clés (clics jeux, ouverture streams, navigation)</td>
                        <td className="py-3 px-4 text-gray-400">EsportNews</td>
                        <td className="py-3 px-4 text-gray-400">90 jours</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">web_vitals</td>
                        <td className="py-3 px-4">Mesure des Core Web Vitals (LCP, FID, CLS) pour optimiser les performances</td>
                        <td className="py-3 px-4 text-gray-400">Vercel Analytics</td>
                        <td className="py-3 px-4 text-gray-400">7 jours</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#182859]/10 border-l-4 border-blue-400 p-4 mt-4">
                  <p className="text-sm mb-2">
                    <strong className="text-white">Données collectées :</strong> Pages vues, temps passé sur la section "Direct", clics sur les jeux, ouverture de streams, interactions avec les articles/news, comportement de navigation.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    <strong>Note :</strong> Vercel Analytics respecte la vie privée des utilisateurs et ne collecte aucune donnée personnelle identifiable. Les données sont anonymisées.
                  </p>
                </div>
              </div>
            </div>

            {/* Affichage publicitaire */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-[#F22E62]">📢</span>
                Affichage publicitaire
              </h3>
              <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
                <p className="text-sm bg-[#182859]/20 border border-[#182859] rounded px-3 py-2 text-gray-300">
                  Nous affichons des bannières publicitaires sur notre site pour financer le contenu gratuit que nous proposons.
                </p>

                <div className="bg-green-500/10 border-l-4 border-green-400 p-4">
                  <p className="text-sm">
                    <strong className="text-white">✅ Bonne nouvelle :</strong> Nous gérons nos publicités en interne sans utiliser de régies publicitaires externes. <strong className="text-green-400">Aucun cookie publicitaire tiers n'est déposé sur votre appareil.</strong>
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Les bannières publicitaires affichées sont des images statiques fournies directement par nos partenaires commerciaux. Aucun suivi comportemental ou ciblage publicitaire n'est effectué.
                  </p>
                </div>

                <div className="bg-[#182859]/20 rounded p-4">
                  <p className="text-sm mb-3">
                    <strong className="text-white">Mode de fonctionnement selon votre appareil :</strong>
                  </p>

                  <div className="space-y-3">
                    <div className="bg-[#060B13] rounded p-3">
                      <p className="text-sm font-semibold text-white mb-2">🖥️ Desktop (ordinateur)</p>
                      <ul className="text-sm space-y-1 ml-4 text-gray-300">
                        <li>• Bannières publicitaires dans la colonne de droite</li>
                        <li>• Visibles pour <strong>tous les utilisateurs</strong> (y compris abonnés Premium)</li>
                        <li>• 3 emplacements fixes, non intrusifs</li>
                      </ul>
                    </div>

                    <div className="bg-[#060B13] rounded p-3">
                      <p className="text-sm font-semibold text-white mb-2">📱 Mobile (smartphone/tablette)</p>
                      <ul className="text-sm space-y-1 ml-4 text-gray-300">
                        <li>• <strong className="text-[#F22E62]">Abonnés Premium :</strong> aucun popup publicitaire</li>
                        <li>• Utilisateurs gratuits : popups publicitaires occasionnels</li>
                      </ul>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-3 italic">
                    ℹ️ Aucun tracking publicitaire, aucun cookie tiers, peu importe votre statut d'abonnement.
                  </p>
                </div>
              </div>
            </div>

            {/* Cookies de personnalisation */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-purple-400">⚙️</span>
                Cookies de personnalisation
              </h3>
              <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
                <p className="text-sm bg-[#182859]/20 border border-[#182859] rounded px-3 py-2 text-gray-300">
                  Ces cookies permettent de mémoriser vos préférences pour personnaliser votre expérience sur EsportNews.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[#182859]">
                      <tr className="text-left">
                        <th className="py-3 px-4 text-white font-semibold">Nom du cookie</th>
                        <th className="py-3 px-4 text-white font-semibold">Finalité</th>
                        <th className="py-3 px-4 text-white font-semibold">Durée</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#182859]/30">
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">selected_game</td>
                        <td className="py-3 px-4">Mémorisation du dernier jeu consulté (Valorant, CS2, LoL...)</td>
                        <td className="py-3 px-4 text-gray-400">30 jours</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">display_preferences</td>
                        <td className="py-3 px-4">Préférences d'affichage (vue liste/grille, filtres actifs)</td>
                        <td className="py-3 px-4 text-gray-400">90 jours</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-mono text-xs text-gray-400">notification_settings</td>
                        <td className="py-3 px-4">Préférences de notifications (matchs, articles, news)</td>
                        <td className="py-3 px-4 text-gray-400">1 an</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </section>

          {/* Section 3 - Finalités détaillées */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              3. Pourquoi utilisons-nous des cookies ?
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-[#F22E62] font-bold">•</span>
                  <div>
                    <strong className="text-white">Assurer le fonctionnement du site :</strong> authentification, sécurité, maintien de session
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#F22E62] font-bold">•</span>
                  <div>
                    <strong className="text-white">Améliorer votre expérience :</strong> mémorisation de vos préférences (jeu favori, équipes suivies)
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#F22E62] font-bold">•</span>
                  <div>
                    <strong className="text-white">Analyser les performances :</strong> comprendre quelles fonctionnalités sont les plus utilisées (Direct, Tournois, Articles)
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#F22E62] font-bold">•</span>
                  <div>
                    <strong className="text-white">Mesurer l'audience :</strong> statistiques de fréquentation, temps passé, pages populaires
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#F22E62] font-bold">•</span>
                  <div>
                    <strong className="text-white">Financer le contenu gratuit :</strong> affichage de bannières publicitaires (uniquement pour les non-abonnés, sans tracking tiers)
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 - Gestion des préférences */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              4. Comment gérer vos préférences de cookies ?
            </h2>

            <div className="space-y-4">
              {/* CTA Gérer les préférences */}
              <div className="bg-gradient-to-r from-[#F22E62]/20 to-[#182859]/20 border border-[#F22E62]/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Via notre outil de gestion des cookies
                </h3>
                <p className="mb-4 text-sm">
                  Vous pouvez à tout moment accepter, refuser ou personnaliser vos préférences de cookies en cliquant sur le bouton ci-dessous :
                </p>
                <button
                  className="bg-[#F22E62] hover:bg-[#F22E62]/90 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                  onClick={handleOpenCookiePreferences}
                >
                  Gérer mes préférences de cookies
                </button>
                <p className="text-xs text-gray-400 mt-3">
                  Ce panneau vous permet de choisir précisément quels types de cookies vous acceptez.
                </p>
              </div>

              {/* Via le navigateur */}
              <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Via votre navigateur
                </h3>
                <p className="mb-4">
                  Vous pouvez également configurer votre navigateur pour refuser tous les cookies ou être alerté lorsqu'un cookie est déposé :
                </p>

                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-white">Google Chrome :</strong>
                    <p className="text-gray-400 ml-4">Paramètres → Confidentialité et sécurité → Cookies et autres données des sites</p>
                  </div>
                  <div>
                    <strong className="text-white">Firefox :</strong>
                    <p className="text-gray-400 ml-4">Options → Vie privée et sécurité → Cookies et données de sites</p>
                  </div>
                  <div>
                    <strong className="text-white">Safari :</strong>
                    <p className="text-gray-400 ml-4">Préférences → Confidentialité → Gérer les données de sites web</p>
                  </div>
                  <div>
                    <strong className="text-white">Microsoft Edge :</strong>
                    <p className="text-gray-400 ml-4">Paramètres → Cookies et autorisations de site → Gérer et supprimer les cookies</p>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 mt-4">
                  <p className="text-sm text-gray-300">
                    <strong className="text-white">⚠️ Attention :</strong> Le blocage de tous les cookies peut empêcher certaines fonctionnalités du site de fonctionner correctement (connexion, préférences, etc.).
                  </p>
                </div>
              </div>

              {/* Suppression des cookies */}
              <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Supprimer les cookies existants
                </h3>
                <p className="text-sm">
                  Pour supprimer les cookies déjà stockés sur votre appareil, vous devez les effacer via les paramètres de votre navigateur (section "Effacer les données de navigation" ou "Historique").
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 - Abonnement Premium */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              5. Abonnement Premium
            </h2>
            <div className="bg-gradient-to-br from-[#182859]/40 to-[#091626] border border-[#F22E62]/40 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🚀</div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Une expérience mobile sans popups publicitaires
                  </h3>
                  <p className="mb-4">
                    En souscrivant à un abonnement EsportNews Premium, vous bénéficiez d'une navigation mobile <strong className="text-[#F22E62]">sans aucun popup publicitaire intrusif</strong>.
                  </p>

                  <div className="bg-[#182859]/30 rounded p-4 mb-3">
                    <p className="text-sm mb-2">
                      <strong className="text-white">Ce que vous obtenez :</strong>
                    </p>
                    <ul className="text-sm space-y-1 ml-4 text-gray-300">
                      <li>✅ Aucun popup publicitaire sur mobile</li>
                      <li>✅ Navigation fluide sans interruption</li>
                      <li>✅ Accès prioritaire aux fonctionnalités</li>
                    </ul>
                  </div>

                  <p className="text-xs text-gray-400 bg-[#060B13]/50 rounded p-3">
                    <strong>Note :</strong> Les bannières publicitaires desktop restent visibles mais sont non-intrusives (colonne latérale fixe). Elles nous permettent de continuer à financer la plateforme et le contenu de qualité.
                  </p>

                  <p className="text-xs text-gray-400 mt-3">
                    Les cookies strictement nécessaires et de personnalisation restent actifs pour vous garantir une expérience optimale. Les cookies analytics peuvent être désactivés via le panneau de gestion.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6 - Vos droits */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              6. Vos droits concernant vos données
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="mb-4">
                Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
              </p>
              <ul className="space-y-2 ml-4">
                <li className="flex gap-2">
                  <span className="text-[#F22E62]">→</span>
                  <span><strong className="text-white">Droit d'accès</strong> : obtenir une copie de vos données</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#F22E62]">→</span>
                  <span><strong className="text-white">Droit de rectification</strong> : corriger vos données inexactes</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#F22E62]">→</span>
                  <span><strong className="text-white">Droit à l'effacement</strong> : supprimer vos données</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#F22E62]">→</span>
                  <span><strong className="text-white">Droit d'opposition</strong> : refuser certains traitements (analytics, personnalisation)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#F22E62]">→</span>
                  <span><strong className="text-white">Droit à la portabilité</strong> : récupérer vos données dans un format structuré</span>
                </li>
              </ul>
              <p className="mt-4 text-sm">
                Pour exercer vos droits, consultez notre <a href="/politique-confidentialite" className="text-[#F22E62] hover:underline">Politique de confidentialité</a> ou contactez-nous directement.
              </p>
            </div>
          </section>

          {/* Section 7 - Durées de conservation */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              7. Durées de conservation
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="mb-4">
                Les cookies sont conservés pour des durées variables selon leur finalité :
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#182859]/20 rounded p-4">
                  <h4 className="text-white font-semibold mb-2">Cookies de session</h4>
                  <p className="text-sm text-gray-400">Supprimés à la fermeture du navigateur</p>
                </div>
                <div className="bg-[#182859]/20 rounded p-4">
                  <h4 className="text-white font-semibold mb-2">Cookies fonctionnels</h4>
                  <p className="text-sm text-gray-400">Maximum 12 mois</p>
                </div>
                <div className="bg-[#182859]/20 rounded p-4">
                  <h4 className="text-white font-semibold mb-2">Cookies analytics</h4>
                  <p className="text-sm text-gray-400">Maximum 24 mois</p>
                </div>
                <div className="bg-[#182859]/20 rounded p-4">
                  <h4 className="text-white font-semibold mb-2">Cookies de personnalisation</h4>
                  <p className="text-sm text-gray-400">Maximum 12 mois</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-400">
                Votre consentement est conservé pendant 12 mois maximum, après quoi nous vous demanderons à nouveau votre autorisation.
              </p>
            </div>
          </section>

          {/* Section 8 - Modifications */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              8. Modifications de cette politique
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p>
                Nous nous réservons le droit de modifier cette politique de gestion des cookies à tout moment, notamment pour nous conformer aux évolutions réglementaires ou adapter nos pratiques.
              </p>
              <p className="mt-3">
                Toute modification substantielle vous sera communiquée par une notification sur le site ou par email. Nous vous invitons à consulter régulièrement cette page pour rester informé.
              </p>
            </div>
          </section>

          {/* Section 9 - Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              9. Nous contacter
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <p className="mb-4">
                Pour toute question concernant notre utilisation des cookies ou pour exercer vos droits :
              </p>
              <div className="space-y-2 text-sm">
                <p>
                  <strong className="text-white">Email :</strong> <a href="mailto:dpo@esportnews.com" className="text-[#F22E62] hover:underline">dpo@esportnews.com</a>
                </p>
                <p>
                  <strong className="text-white">Délégué à la Protection des Données (DPO) :</strong> [Nom à compléter]
                </p>
                <p className="text-gray-400 mt-4">
                  Vous pouvez également introduire une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) si vous estimez que vos droits ne sont pas respectés.
                </p>
              </div>
            </div>
          </section>

          {/* Section 10 - Liens utiles */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              10. Liens utiles
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6">
              <ul className="space-y-2">
                <li>
                  <a href="/politique-confidentialite" className="text-[#F22E62] hover:underline">
                    → Politique de confidentialité
                  </a>
                </li>
                <li>
                  <a href="/mentions-legales" className="text-[#F22E62] hover:underline">
                    → Mentions légales
                  </a>
                </li>
                <li>
                  <a href="/cgu" className="text-[#F22E62] hover:underline">
                    → Conditions générales d'utilisation
                  </a>
                </li>
                <li>
                  <a href="https://www.cnil.fr/fr/cookies-et-autres-traceurs" target="_blank" rel="noopener noreferrer" className="text-[#F22E62] hover:underline">
                    → Site de la CNIL sur les cookies ↗
                  </a>
                </li>
              </ul>
            </div>
          </section>

        </div>

        {/* Footer CTA */}
        <div className="mt-12 pt-8 border-t border-[#182859]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              Dernière mise à jour : {currentDate && new Date().toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
            <button
              className="bg-[#182859] hover:bg-[#182859]/80 text-white px-6 py-2 rounded-lg transition-colors text-sm"
              onClick={handleOpenCookiePreferences}
            >
              Gérer mes préférences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
