import React from 'react';
import { LegalPageTemplate, Section, Paragraph, BulletPoint, InfoBox } from '@/components/legal/LegalPageTemplate';
import { Text } from 'react-native-paper';

export default function CGVScreen() {
  return (
    <LegalPageTemplate title="Conditions de Vente">
      <Section title="Abonnement Premium">
        <Paragraph>
          <Text style={{ fontWeight: '600', fontSize: 20 }}>0,99 € TTC / mois</Text>{'\n'}
          TVA française 20% incluse{'\n'}
          Sans engagement - Résiliable à tout moment
        </Paragraph>
      </Section>

      <Section title="Avantages Premium">
        <BulletPoint><Text style={{ fontWeight: '600' }}>Navigation sans popup</Text> - Aucun popup publicitaire sur l'application mobile</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Concours exclusifs</Text> - Accès prioritaire et avantages pour les concours</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Badge Premium</Text> - Identification visuelle sur votre profil</BulletPoint>

        <InfoBox type="info">
          Note : La colonne publicitaire desktop reste affichée pour tous les utilisateurs (y compris Premium)
        </InfoBox>
      </Section>

      <Section title="Paiement">
        <Paragraph>
          Paiement exclusif par <Text style={{ fontWeight: '600' }}>carte bancaire via Stripe</Text> (certifié PCI-DSS).
        </Paragraph>
        <Paragraph>
          Cartes acceptées : Visa, Mastercard, American Express
        </Paragraph>

        <InfoBox type="success">
          ✅ ESPORT NEWS ne stocke aucune donnée bancaire{'\n'}
          ✅ Transactions 100% sécurisées par Stripe
        </InfoBox>
      </Section>

      <Section title="Renouvellement">
        <Paragraph>
          L'abonnement se renouvelle <Text style={{ fontWeight: '600' }}>automatiquement chaque mois</Text> à la date anniversaire de souscription.
        </Paragraph>
        <Paragraph>
          Prélèvement automatique de 0,99 € à chaque renouvellement. Une facture est envoyée par email.
        </Paragraph>
      </Section>

      <Section title="Droit de rétractation (UE)">
        <Paragraph>
          Vous disposez d'un <Text style={{ fontWeight: '600' }}>délai de 14 jours</Text> pour exercer votre droit de rétractation, sans justification.
        </Paragraph>
        <Paragraph>
          En souscrivant, vous acceptez que le service soit fourni immédiatement (renonciation au droit de rétractation après utilisation complète).
        </Paragraph>

        <InfoBox type="warning">
          Pour exercer votre rétractation :{'\n'}
          • Email : contact@esportnews.fr{'\n'}
          • Ou via le bouton "Résilier" dans votre profil
        </InfoBox>
      </Section>

      <Section title="Résiliation">
        <Paragraph>
          Vous pouvez résilier votre abonnement <Text style={{ fontWeight: '600' }}>à tout moment, sans frais</Text>.
        </Paragraph>
        <Paragraph>
          La résiliation prend effet à la fin de la période en cours déjà payée. Vous continuez à bénéficier du Premium jusqu'à l'expiration.
        </Paragraph>

        <InfoBox type="info">
          Aucun remboursement au prorata pour la période en cours (conformément aux CGV des services numériques et conditions Stripe)
        </InfoBox>
      </Section>

      <Section title="Politique de remboursement">
        <BulletPoint><Text style={{ fontWeight: '600' }}>Dans les 14 jours :</Text> Remboursement intégral (droit de rétractation légal)</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Après 14 jours :</Text> Aucun remboursement (sauf cas exceptionnels)</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Cas exceptionnels :</Text> Erreur technique, double facturation, prélèvement non autorisé</BulletPoint>

        <Paragraph>
          Délai de remboursement : 5-10 jours ouvrés via Stripe
        </Paragraph>
      </Section>

      <Section title="Modification du tarif">
        <Paragraph>
          ESPORT NEWS se réserve le droit de modifier le tarif avec notification par email <Text style={{ fontWeight: '600' }}>30 jours avant</Text> application.
        </Paragraph>
        <Paragraph>
          Vous pouvez résilier avant la date d'application du nouveau prix si vous refusez l'augmentation.
        </Paragraph>
      </Section>

      <Section title="Données personnelles">
        <Paragraph>
          Les données de paiement sont traitées exclusivement par Stripe. Consultez notre Politique de Confidentialité pour plus d'informations.
        </Paragraph>
      </Section>

      <Section title="Contact">
        <Paragraph>
          Pour toute question concernant votre abonnement :{'\n'}
          contact@esportnews.fr
        </Paragraph>
        <Paragraph>
          Délai de réponse moyen : 48 heures ouvrées
        </Paragraph>
      </Section>
    </LegalPageTemplate>
  );
}
