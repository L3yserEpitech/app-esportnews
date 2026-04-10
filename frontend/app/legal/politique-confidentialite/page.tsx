import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité | EsportNews',
  description: 'Comment ESPORT NEWS protège vos données personnelles - Conformité RGPD',
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-[#060B13] pt-20">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* En-tête */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Politique de Confidentialité
          </h1>
          <p className="text-gray-400">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
          <p className="text-gray-300 mt-4">
            ESPORT NEWS s'engage à protéger vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
          </p>
        </div>

        {/* Contenu */}
        <div className="space-y-8 text-gray-300">
          {/* Responsable du traitement */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              1. Responsable du traitement des données
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-2">
              <p><strong className="text-white">Responsable :</strong> ESPORT NEWS (SAS)</p>
              <p><strong className="text-white">Siège social :</strong> 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France</p>
              <p><strong className="text-white">SIRET :</strong> 987 953 247</p>
              <p><strong className="text-white">Email :</strong> <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a></p>
            </div>
          </section>

          {/* Données collectées */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              2. Données personnelles collectées
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Lors de la création de compte :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Nom et prénom</li>
                  <li>Adresse email (identifiant unique)</li>
                  <li>Mot de passe (stocké de manière sécurisée et cryptée)</li>
                  <li>Photo de profil (avatar) — facultatif</li>
                  <li>Date de naissance (pour vérification de l'âge)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Lors de l'utilisation des services :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Équipes favorites (pour personnalisation du contenu)</li>
                  <li>Préférences de notifications (push, articles, actualités, matchs)</li>
                  <li>Historique de lecture d'articles (nombre de vues par article uniquement, sans stockage de l'historique utilisateur)</li>
                  <li>Préférences de jeux (pour affichage personnalisé)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Données techniques :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Adresse IP (pour sécurité et prévention de la fraude)</li>
                  <li>Type d'appareil et système d'exploitation</li>
                  <li>Navigateur utilisé</li>
                  <li>Cookies techniques (sessions uniquement)</li>
                  <li>Logs de connexion (date et heure)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Lors de l'abonnement Premium :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Informations de paiement (traitées exclusivement par Stripe — nous ne conservons aucune donnée bancaire)</li>
                  <li>Sur mobile : les paiements de l'abonnement ESPORT NEWS Premium (0,99 €/mois) sont gérés exclusivement par Apple (App Store) ou Google (Google Play). Nous ne collectons ni ne stockons aucune donnée bancaire ou de paiement.</li>
                  <li>Historique de facturation</li>
                  <li>Statut de l'abonnement</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-[#182859]/30">
                <p className="text-sm text-gray-400">
                  <strong className="text-white">Important :</strong> Nous ne collectons AUCUNE donnée de navigation comportementale à des fins publicitaires. Notre système de comptage de vues d'articles est purement statistique et ne permet pas de tracer les utilisateurs.
                </p>
              </div>
            </div>
          </section>

          {/* Finalités du traitement */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              3. Finalités du traitement et bases légales
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Exécution du contrat :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Création et gestion de votre compte utilisateur</li>
                  <li>Accès aux fonctionnalités de la plateforme</li>
                  <li>Gestion de l'abonnement Premium</li>
                  <li>Support technique et assistance</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Intérêt légitime :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Amélioration des services et de l'expérience utilisateur</li>
                  <li>Statistiques de fréquentation (comptage de vues d'articles)</li>
                  <li>Sécurité de la plateforme et prévention de la fraude</li>
                  <li>Maintenance technique</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Consentement (facultatif) :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Envoi de notifications push</li>
                  <li>Envoi de newsletters et actualités par email</li>
                  <li>Personnalisation des contenus selon vos préférences</li>
                </ul>
                <p className="text-sm text-gray-400 mt-2">
                  Vous pouvez retirer votre consentement à tout moment depuis votre profil utilisateur.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Obligation légale :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Conservation des factures (10 ans pour obligations comptables)</li>
                  <li>Réponse aux réquisitions judiciaires</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Destinataires des données */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              4. Destinataires des données
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Vos données personnelles sont accessibles uniquement aux personnes et entités suivantes :</p>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">En interne :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Équipe technique d'ESPORT NEWS (développement et maintenance)</li>
                  <li>Service support client</li>
                  <li>Direction (pour gestion administrative)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Prestataires techniques (sous-traitants RGPD) :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li><strong className="text-white">Hébergement :</strong> Prestataire technique indépendant en France (serveur VPS)</li>
                  <li><strong className="text-white">Paiement :</strong> Stripe (certifié PCI-DSS, traite les paiements de manière sécurisée)</li>
                  <li><strong className="text-white">Stockage d'images :</strong> Cloudflare R2 (pour avatars et médias)</li>
                  <li><strong className="text-white">Emails transactionnels :</strong> Service d'envoi d'emails (pour notifications de compte)</li>
                </ul>
                <p className="text-sm text-gray-400 mt-2">
                  Tous nos sous-traitants sont liés par des contrats de protection des données conformes au RGPD.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Fournisseurs de données esport :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li><strong className="text-white">PandaScore :</strong> Fournit les données de tournois, matchs (y compris en direct), équipes et statistiques (aucune donnée utilisateur partagée)</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-[#182859]/30">
                <p className="text-sm text-gray-400">
                  <strong className="text-white">Important :</strong> Nous ne vendons ni ne louons vos données personnelles à des tiers. Nous n'utilisons AUCUNE régie publicitaire externe (Google AdSense, Meta Ads, etc.).
                </p>
              </div>
            </div>
          </section>

          {/* Durée de conservation */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              5. Durée de conservation des données
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <ul className="list-disc list-inside ml-2 space-y-2">
                <li>
                  <strong className="text-white">Compte actif :</strong> Données conservées tant que le compte existe et est utilisé
                </li>
                <li>
                  <strong className="text-white">Compte inactif :</strong> Suppression après 3 ans d'inactivité (aucune connexion), après notification par email
                </li>
                <li>
                  <strong className="text-white">Suppression de compte :</strong> Suppression immédiate des données personnelles, sauf obligations légales (factures : 10 ans)
                </li>
                <li>
                  <strong className="text-white">Logs de sécurité :</strong> Conservés 12 mois maximum
                </li>
                <li>
                  <strong className="text-white">Cookies de session :</strong> Supprimés automatiquement à la fermeture du navigateur
                </li>
                <li>
                  <strong className="text-white">Données de paiement :</strong> Conservées par Stripe selon leurs politiques (conformes PCI-DSS)
                </li>
                <li>
                  <strong className="text-white">Newsletters/Notifications :</strong> Jusqu'au retrait du consentement ou 3 ans après le dernier contact
                </li>
              </ul>
            </div>
          </section>

          {/* Transferts hors UE */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              6. Transferts de données hors Union Européenne
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>La majorité de vos données sont hébergées en France (serveur VPS) et restent dans l'Union Européenne.</p>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-white mb-2">Transferts éventuels :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>
                    <strong className="text-white">Stripe (USA) :</strong> Certifié EU-US Data Privacy Framework, utilise des Clauses Contractuelles Types (CCT) de la Commission européenne
                  </li>
                  <li>
                    <strong className="text-white">Cloudflare (réseau mondial) :</strong> Données d'images anonymes, conformité RGPD via CCT
                  </li>
                </ul>
              </div>

              <p className="text-sm text-gray-400 mt-4">
                Tous les transferts hors UE sont encadrés par des garanties appropriées conformément au RGPD (articles 45 et 46).
              </p>
            </div>
          </section>

          {/* Vos droits RGPD */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              7. Vos droits sur vos données personnelles
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <p>Conformément au RGPD, vous disposez des droits suivants :</p>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">✓ Droit d'accès</h3>
                <p className="text-sm">Obtenir une copie de toutes vos données personnelles que nous détenons.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">✓ Droit de rectification</h3>
                <p className="text-sm">Corriger des données inexactes ou incomplètes (modifiable directement depuis votre profil).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">✓ Droit à l'effacement ("droit à l'oubli")</h3>
                <p className="text-sm">Demander la suppression de vos données personnelles (disponible dans votre profil : "Supprimer mon compte").</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">✓ Droit à la limitation du traitement</h3>
                <p className="text-sm">Demander le gel temporaire du traitement de vos données dans certaines situations.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">✓ Droit à la portabilité</h3>
                <p className="text-sm">Recevoir vos données dans un format structuré et lisible par machine (JSON), et les transférer à un autre service.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">✓ Droit d'opposition</h3>
                <p className="text-sm">Vous opposer au traitement de vos données pour des raisons tenant à votre situation particulière (notamment pour la prospection commerciale).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">✓ Droit de retirer votre consentement</h3>
                <p className="text-sm">Retirer votre consentement à tout moment pour les notifications push, newsletters, etc. (gérable depuis votre profil).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">✓ Directives post-mortem</h3>
                <p className="text-sm">Définir des directives concernant la conservation, l'effacement ou la communication de vos données après votre décès.</p>
              </div>

              <div className="pt-4 border-t border-[#182859]/30">
                <h3 className="text-lg font-semibold text-white mb-2">Comment exercer vos droits ?</h3>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>
                    <strong className="text-white">Par email :</strong> <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a> (objet : "Exercice de mes droits RGPD")
                  </li>
                  <li>
                    <strong className="text-white">Par courrier :</strong> ESPORT NEWS, 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France
                  </li>
                  <li>
                    <strong className="text-white">Depuis votre profil :</strong> Section "Mes données et confidentialité"
                  </li>
                </ul>
                <p className="text-sm text-gray-400 mt-3">
                  Nous nous engageons à répondre dans un délai maximum de <strong className="text-white">1 mois</strong> suivant votre demande. Une pièce d'identité pourra être demandée pour vérifier votre identité.
                </p>
              </div>
            </div>
          </section>

          {/* Sécurité des données */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              8. Sécurité de vos données
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS met en œuvre toutes les mesures techniques et organisationnelles appropriées pour protéger vos données personnelles :</p>

              <ul className="list-disc list-inside ml-2 space-y-2 mt-3">
                <li>
                  <strong className="text-white">Chiffrement :</strong> Connexions HTTPS (TLS 1.3), mots de passe hashés avec bcrypt
                </li>
                <li>
                  <strong className="text-white">Authentification sécurisée :</strong> Tokens JWT avec expiration courte, sessions sécurisées
                </li>
                <li>
                  <strong className="text-white">Accès restreint :</strong> Principe du moindre privilège, accès limité aux données selon les fonctions
                </li>
                <li>
                  <strong className="text-white">Hébergement sécurisé :</strong> Serveur VPS en France avec pare-feu, monitoring 24/7
                </li>
                <li>
                  <strong className="text-white">Sauvegardes régulières :</strong> Backups quotidiens chiffrés
                </li>
                <li>
                  <strong className="text-white">Audit de sécurité :</strong> Revue régulière des accès et des logs
                </li>
              </ul>

              <p className="text-sm text-gray-400 mt-4">
                En cas de violation de données personnelles susceptible d'engendrer un risque élevé pour vos droits et libertés, nous vous en informerons dans les meilleurs délais conformément au RGPD.
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              9. Cookies et technologies similaires
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS utilise uniquement des <strong className="text-white">cookies techniques strictement nécessaires</strong> au fonctionnement du site :</p>

              <ul className="list-disc list-inside ml-2 space-y-2 mt-3">
                <li>
                  <strong className="text-white">Cookie de session (JWT) :</strong> Authentification utilisateur, expire à la déconnexion
                </li>
                <li>
                  <strong className="text-white">Préférences utilisateur :</strong> Sauvegarde locale des préférences d'affichage (jeux favoris, etc.)
                </li>
              </ul>

              <p className="text-sm text-gray-400 mt-4">
                ✅ <strong className="text-white">Aucun cookie publicitaire tiers</strong> (Google AdSense, Meta Pixel, etc.)<br />
                ✅ <strong className="text-white">Aucun tracking comportemental</strong><br />
                ✅ <strong className="text-white">Pas de consentement requis</strong> (cookies techniques uniquement)
              </p>

              <p className="mt-4">
                Pour plus d'informations : <a href="/legal/cookies" className="text-[#F22E62] hover:underline">Politique de gestion des cookies</a>
              </p>
            </div>
          </section>

          {/* Mineurs */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              10. Données des mineurs
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS est accessible aux utilisateurs de <strong className="text-white">13 ans et plus</strong>.</p>

              <p className="mt-3">Pour les mineurs de moins de 15 ans, le consentement des parents ou représentants légaux est requis pour certains traitements (newsletters, notifications push).</p>

              <div className="bg-[#182859]/20 rounded p-4 mt-3">
                <p className="text-sm">
                  <strong className="text-white">Vérification de l'âge :</strong><br />
                  • <strong className="text-white">Application mobile :</strong> L'âge est demandé obligatoirement lors de l'inscription (minimum 13 ans)<br />
                  • <strong className="text-white">Site web :</strong> L'âge est optionnel mais recommandé (si fourni, minimum 13 ans)
                </p>
              </div>

              <p className="text-sm text-gray-400 mt-3">
                Si vous êtes parent et souhaitez exercer les droits RGPD au nom de votre enfant mineur, contactez-nous à <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a>.
              </p>
            </div>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              11. Modifications de la politique de confidentialité
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS se réserve le droit de modifier cette politique de confidentialité à tout moment.</p>

              <p className="mt-3">Toute modification substantielle vous sera notifiée par email ou via une notification sur la plateforme, au moins <strong className="text-white">30 jours avant</strong> son entrée en vigueur.</p>

              <p className="text-sm text-gray-400 mt-3">
                La date de dernière mise à jour est indiquée en haut de cette page.
              </p>
            </div>
          </section>

          {/* Réclamation CNIL */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              12. Réclamation auprès de la CNIL
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Si vous estimez que vos droits ne sont pas respectés, vous avez le droit d'introduire une réclamation auprès de l'autorité de contrôle compétente :</p>

              <div className="mt-4 p-4 bg-[#060B13] rounded border border-[#182859]/30">
                <p><strong className="text-white">Commission Nationale de l'Informatique et des Libertés (CNIL)</strong></p>
                <p className="text-sm mt-2">
                  Adresse : 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07<br />
                  Téléphone : 01 53 73 22 22<br />
                  Site web : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[#F22E62] hover:underline">www.cnil.fr</a>
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              13. Contact
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Pour toute question concernant cette politique de confidentialité ou l'exercice de vos droits :</p>

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
        </div>
      </div>
    </div>
  );
}
