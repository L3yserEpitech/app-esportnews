import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente | EsportNews',
  description: 'Conditions de vente de l\'abonnement Premium ESPORT NEWS',
};

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-[#060B13] pt-20">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* En-tête */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Conditions Générales de Vente (CGV)
          </h1>
          <p className="text-gray-400">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
          <p className="text-gray-300 mt-4">
            Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent la souscription à l'abonnement Premium proposé par ESPORT NEWS.
          </p>
        </div>

        {/* Contenu */}
        <div className="space-y-8 text-gray-300">
          {/* Article 1 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 1 - Informations légales
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-2">
              <p><strong className="text-white">Vendeur :</strong> ESPORT NEWS</p>
              <p><strong className="text-white">Forme juridique :</strong> Société par Actions Simplifiée (SAS)</p>
              <p><strong className="text-white">Capital social :</strong> 1 000,00 €</p>
              <p><strong className="text-white">Siège social :</strong> 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France</p>
              <p><strong className="text-white">SIRET :</strong> 987 953 247 | <strong className="text-white">SIREN :</strong> 98795324700010</p>
              <p><strong className="text-white">N° TVA intracommunautaire :</strong> FR18987953247</p>
              <p><strong className="text-white">Email :</strong> <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a></p>
            </div>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 2 - Objet
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Les présentes CGV ont pour objet de définir les conditions de souscription et d'utilisation de l'<strong className="text-white">Abonnement Premium ESPORT NEWS</strong>, un service payant proposé sur la plateforme ESPORT NEWS (site web et application mobile).</p>
              <p className="mt-3">
                Toute souscription à l'abonnement Premium implique l'acceptation pleine et entière des présentes CGV, sans réserve, ainsi que des <a href="/legal/cgu" className="text-[#F22E62] hover:underline">Conditions Générales d'Utilisation</a>.
              </p>
            </div>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 3 - Description du service Premium
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <p>L'abonnement Premium ESPORT NEWS offre les avantages suivants :</p>

              <div className="bg-[#060B13] rounded-lg p-4 border border-[#182859]/30">
                <h3 className="text-lg font-semibold text-white mb-3">✨ Avantages Premium</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-[#F22E62] mr-2">✓</span>
                    <span><strong className="text-white">Navigation sans popup publicitaire sur mobile</strong> — Désactivation complète des popups publicitaires sur l'application mobile et le site mobile</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#F22E62] mr-2">✓</span>
                    <span><strong className="text-white">Avantages exclusifs pour les concours</strong> — Accès prioritaire, chances de gains augmentées ou lots réservés aux abonnés Premium</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#F22E62] mr-2">✓</span>
                    <span><strong className="text-white">Badge Premium</strong> — Identification visuelle en tant qu'abonné Premium sur votre profil</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-4 border-t border-[#182859]/30">
                <p className="text-sm text-gray-400">
                  <strong className="text-white">Important :</strong> La colonne publicitaire desktop reste affichée pour tous les utilisateurs, y compris les abonnés Premium. Seuls les popups publicitaires mobile sont désactivés.
                </p>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-white mb-2">Services non inclus :</h3>
                <ul className="list-disc list-inside ml-2 space-y-1 text-sm text-gray-400">
                  <li>L'abonnement Premium ne donne pas accès à des contenus éditoriaux exclusifs (tous les articles restent gratuits)</li>
                  <li>L'abonnement ne modifie pas les fonctionnalités de la plateforme (équipes favorites, notifications, calendrier)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 4 - Prix et modalités de paiement
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.1 Tarif</h3>
                <div className="bg-[#060B13] rounded-lg p-4 border border-[#F22E62]/30">
                  <p className="text-2xl font-bold text-white">0,99 € TTC / mois</p>
                  <p className="text-sm text-gray-400 mt-1">Prix incluant la TVA française à 20% (services numériques)</p>
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  Le prix est indiqué en euros (€), toutes taxes comprises (TTC). Ce tarif peut être modifié à tout moment par ESPORT NEWS, avec notification préalable aux abonnés en cours.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.2 Moyens de paiement acceptés</h3>
                <p>Le paiement s'effectue exclusivement par <strong className="text-white">carte bancaire via Stripe</strong> (plateforme de paiement sécurisée certifiée PCI-DSS).</p>
                <ul className="list-disc list-inside ml-2 space-y-1 mt-2 text-sm">
                  <li>Cartes Visa, Mastercard, American Express</li>
                  <li>Cartes de débit et de crédit</li>
                  <li>Apple Pay et Google Pay (si disponibles)</li>
                </ul>
                <p className="text-sm text-gray-400 mt-3">
                  ✅ ESPORT NEWS ne stocke aucune donnée bancaire. Toutes les transactions sont traitées de manière sécurisée par Stripe.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.3 Facturation</h3>
                <p>Le prélèvement mensuel de <strong className="text-white">0,99 €</strong> s'effectue automatiquement à chaque date anniversaire de souscription.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Exemple : si vous souscrivez le 15 janvier, vous serez prélevé(e) le 15 de chaque mois suivant (ou le dernier jour du mois si la date n'existe pas).
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Une facture est automatiquement générée et envoyée par email à chaque prélèvement.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.4 Échec de paiement</h3>
                <p className="text-sm">
                  En cas d'échec de paiement (carte expirée, fonds insuffisants, opposition bancaire), ESPORT NEWS vous notifiera par email. Vous disposerez de <strong className="text-white">7 jours</strong> pour régulariser la situation.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Passé ce délai, votre abonnement sera automatiquement suspendu et les avantages Premium désactivés. Vous pourrez réactiver l'abonnement en mettant à jour vos informations de paiement.
                </p>
              </div>
            </div>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 5 - Durée et renouvellement de l'abonnement
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">5.1 Durée d'engagement</h3>
                <p>L'abonnement Premium est <strong className="text-white">mensuel, sans engagement de durée</strong>.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Vous pouvez résilier à tout moment, sans frais ni pénalités.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">5.2 Renouvellement automatique</h3>
                <p>L'abonnement se renouvelle <strong className="text-white">automatiquement chaque mois</strong> à la date anniversaire de souscription, jusqu'à résiliation de votre part.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Le prélèvement mensuel de 0,99 € s'effectue automatiquement sur votre moyen de paiement enregistré.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">5.3 Activation immédiate</h3>
                <p>L'abonnement Premium est activé <strong className="text-white">immédiatement après validation du paiement</strong>.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Vous bénéficiez des avantages Premium dès la confirmation de votre souscription.
                </p>
              </div>
            </div>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 6 - Droit de rétractation (consommateurs UE)
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.1 Délai de rétractation</h3>
                <p>Conformément au Code de la consommation français et à la directive européenne 2011/83/UE, vous disposez d'un <strong className="text-white">délai de 14 jours</strong> pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Le délai court à compter de la date de souscription à l'abonnement Premium.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.2 Renonciation au droit de rétractation</h3>
                <p>En souscrivant à l'abonnement Premium, vous acceptez que le service soit fourni <strong className="text-white">immédiatement</strong>, avant l'expiration du délai de rétractation de 14 jours.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Conformément à l'article L.221-28 du Code de la consommation, vous renoncez expressément à votre droit de rétractation en cas d'utilisation complète du service avant l'expiration du délai de 14 jours.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.3 Modalités d'exercice</h3>
                <p className="text-sm">Pour exercer votre droit de rétractation (dans les 14 jours suivant la souscription) :</p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-sm mt-2">
                  <li>Envoyez un email à <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a> avec l'objet "Rétractation abonnement Premium"</li>
                  <li>Ou utilisez le bouton "Résilier mon abonnement" dans votre profil utilisateur</li>
                </ul>
                <p className="text-sm text-gray-400 mt-3">
                  Le remboursement s'effectuera dans un délai maximum de <strong className="text-white">14 jours</strong> suivant la notification de rétractation, sur le même moyen de paiement utilisé lors de la souscription.
                </p>
              </div>
            </div>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 7 - Résiliation de l'abonnement
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">7.1 Résiliation à l'initiative de l'abonné</h3>
                <p>Vous pouvez résilier votre abonnement Premium à tout moment, sans préavis ni frais, depuis votre profil utilisateur (section "Mon abonnement").</p>
                <p className="text-sm text-gray-400 mt-2">
                  La résiliation prend effet à la <strong className="text-white">fin de la période en cours déjà payée</strong>. Vous continuez à bénéficier des avantages Premium jusqu'à l'expiration de la période mensuelle en cours.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  <strong className="text-white">Important :</strong> Aucun remboursement au prorata ne sera effectué pour la période en cours (conformément aux conditions Stripe et aux CGV des services numériques).
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">7.2 Résiliation à l'initiative d'ESPORT NEWS</h3>
                <p>ESPORT NEWS se réserve le droit de résilier votre abonnement Premium en cas de :</p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
                  <li>Non-paiement (après relance et expiration du délai de régularisation de 7 jours)</li>
                  <li>Violation des Conditions Générales d'Utilisation</li>
                  <li>Utilisation frauduleuse du service</li>
                  <li>Cessation du service Premium (avec notification préalable de 30 jours minimum)</li>
                </ul>
                <p className="text-sm text-gray-400 mt-3">
                  En cas de résiliation pour motif légitime (violation des CGU, fraude), aucun remboursement ne sera effectué.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">7.3 Conséquences de la résiliation</h3>
                <p className="text-sm">À l'expiration de votre abonnement Premium :</p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
                  <li>Les popups publicitaires mobiles seront réactivés</li>
                  <li>Vous perdez l'accès aux avantages exclusifs pour les concours</li>
                  <li>Le badge Premium est retiré de votre profil</li>
                  <li>Votre compte utilisateur reste actif avec toutes les fonctionnalités gratuites</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 8 - Politique de remboursement
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">8.1 Droit de rétractation légal (14 jours)</h3>
                <p className="text-sm">Remboursement intégral possible dans les <strong className="text-white">14 jours</strong> suivant la souscription, conformément au droit de rétractation européen (voir Article 6).</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">8.2 Remboursement après 14 jours</h3>
                <p className="text-sm">Passé le délai de rétractation de 14 jours, <strong className="text-white">aucun remboursement</strong> ne sera effectué, conformément aux conditions générales de Stripe et aux pratiques standards des services d'abonnement numérique.</p>
                <p className="text-sm text-gray-400 mt-2">
                  En cas de résiliation, vous continuez à bénéficier du service Premium jusqu'à la fin de la période mensuelle déjà payée.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">8.3 Remboursement exceptionnel</h3>
                <p className="text-sm">ESPORT NEWS se réserve le droit d'accorder un remboursement exceptionnel au cas par cas, notamment en cas de :</p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-sm text-gray-400">
                  <li>Erreur technique empêchant l'utilisation du service Premium</li>
                  <li>Prélèvement non autorisé ou frauduleux</li>
                  <li>Double facturation</li>
                </ul>
                <p className="text-sm text-gray-400 mt-3">
                  Pour toute demande de remboursement exceptionnel, contactez <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a> avec votre numéro de facture.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">8.4 Délai de remboursement</h3>
                <p className="text-sm text-gray-400">
                  Les remboursements sont traités par Stripe dans un délai de <strong className="text-white">5 à 10 jours ouvrés</strong> suivant l'approbation. Le montant sera crédité sur le moyen de paiement utilisé lors de la souscription.
                </p>
              </div>
            </div>
          </section>

          {/* Article 9 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 9 - Modification du tarif
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS se réserve le droit de modifier le tarif de l'abonnement Premium à tout moment.</p>

              <p className="mt-3">
                Toute augmentation de tarif sera notifiée aux abonnés en cours par email, au moins <strong className="text-white">30 jours avant</strong> son application.
              </p>

              <p className="text-sm text-gray-400 mt-3">
                Si vous n'acceptez pas le nouveau tarif, vous pouvez résilier votre abonnement avant la date d'application du nouveau prix. À défaut de résiliation, la poursuite de l'abonnement vaudra acceptation du nouveau tarif.
              </p>
            </div>
          </section>

          {/* Article 10 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 10 - Disponibilité du service Premium
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS s'engage à fournir le service Premium de manière continue, mais ne peut garantir une disponibilité ininterrompue.</p>

              <p className="mt-3 text-sm text-gray-400">
                Des interruptions peuvent survenir pour maintenance technique, mises à jour, incidents ou problèmes indépendants de notre volonté. Ces interruptions ne donnent pas droit à remboursement, sauf indisponibilité prolongée supérieure à 7 jours consécutifs.
              </p>
            </div>
          </section>

          {/* Article 11 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 11 - Données personnelles
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Les données personnelles collectées lors de la souscription à l'abonnement Premium (nom, prénom, email, données de paiement) sont traitées conformément à notre <a href="/legal/politique-confidentialite" className="text-[#F22E62] hover:underline">Politique de Confidentialité</a>.</p>

              <div className="mt-4 space-y-2 text-sm">
                <p><strong className="text-white">Données de paiement :</strong> Traitées exclusivement par Stripe (certifié PCI-DSS). ESPORT NEWS ne stocke aucune donnée bancaire.</p>
                <p><strong className="text-white">Factures :</strong> Conservées 10 ans conformément aux obligations comptables françaises.</p>
                <p><strong className="text-white">Vos droits :</strong> Accès, rectification, suppression (sauf factures soumises à obligation légale). Contactez <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a>.</p>
              </div>
            </div>
          </section>

          {/* Article 12 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 12 - Responsabilité
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS s'engage à fournir le service Premium décrit à l'Article 3 des présentes CGV.</p>

              <p className="text-sm text-gray-400 mt-3">
                ESPORT NEWS ne saurait être tenue responsable de l'impossibilité d'utiliser le service Premium en cas de force majeure, de défaillance technique, de problème lié à Stripe, ou de toute autre cause indépendante de sa volonté.
              </p>

              <p className="text-sm text-gray-400 mt-3">
                En aucun cas, la responsabilité d'ESPORT NEWS ne pourra excéder le montant total versé par l'abonné au cours des 12 derniers mois précédant le litige.
              </p>
            </div>
          </section>

          {/* Article 13 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 13 - Modification des CGV
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>ESPORT NEWS se réserve le droit de modifier les présentes CGV à tout moment.</p>

              <p className="mt-3">
                Toute modification substantielle sera notifiée aux abonnés par email, au moins <strong className="text-white">30 jours avant</strong> son entrée en vigueur.
              </p>

              <p className="text-sm text-gray-400 mt-3">
                La poursuite de l'abonnement après modification vaut acceptation des nouvelles CGV. Si vous n'acceptez pas les modifications, vous pouvez résilier votre abonnement avant leur entrée en vigueur.
              </p>
            </div>
          </section>

          {/* Article 14 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 14 - Droit applicable et juridiction compétente
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Les présentes CGV sont régies par le <strong className="text-white">droit français</strong>.</p>

              <p className="mt-3">
                Tout litige relatif à l'interprétation ou à l'exécution des présentes sera soumis aux <strong className="text-white">juridictions compétentes du ressort de Créteil</strong>, sauf dispositions impératives contraires pour les consommateurs résidant dans l'Union Européenne.
              </p>

              <div className="mt-4 pt-4 border-t border-[#182859]/30">
                <h3 className="text-lg font-semibold text-white mb-2">Médiation pour les consommateurs</h3>
                <p className="text-sm">
                  Conformément à l'article L.612-1 du Code de la consommation, en cas de litige, vous pouvez recourir gratuitement à un médiateur de la consommation avant toute action en justice.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Pour toute réclamation, contactez d'abord notre service client : <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a>
                </p>
              </div>
            </div>
          </section>

          {/* Article 15 */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Article 15 - Contact et support
            </h2>
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 space-y-3">
              <p>Pour toute question concernant votre abonnement Premium ou les présentes CGV :</p>

              <div className="mt-4 space-y-2">
                <p>
                  <strong className="text-white">Email :</strong> <a href="mailto:contact@esportnews.fr" className="text-[#F22E62] hover:underline">contact@esportnews.fr</a>
                </p>
                <p>
                  <strong className="text-white">Courrier :</strong> ESPORT NEWS, 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Délai de réponse moyen : 48 heures ouvrées
                </p>
              </div>
            </div>
          </section>

          {/* Footer CGV */}
          <section className="mt-12 pt-8 border-t border-[#182859]/30">
            <div className="bg-[#091626] border border-[#182859]/30 rounded-lg p-6 text-center space-y-4">
              <p className="text-sm text-gray-400">
                En souscrivant à l'abonnement Premium ESPORT NEWS, vous reconnaissez avoir lu, compris et accepté les présentes Conditions Générales de Vente.
              </p>
              <div className="pt-4 border-t border-[#182859]/30">
                <p className="text-xs text-gray-500">
                  Ces CGV sont conformes au Code de la consommation français, à la directive européenne 2011/83/UE relative aux droits des consommateurs, et au Règlement Général sur la Protection des Données (RGPD).
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
