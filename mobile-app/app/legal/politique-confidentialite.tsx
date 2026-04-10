import React from 'react';
import { LegalPageTemplate, Section, Paragraph, BulletPoint, InfoBox } from '@/components/legal/LegalPageTemplate';
import { Text } from 'react-native-paper';

export default function PolitiqueConfidentialiteScreen() {
  return (
    <LegalPageTemplate title="Confidentialité">
      <Section title="Responsable de traitement">
        <Paragraph>
          <Text style={{ fontWeight: '600' }}>ESPORT NEWS (SAS){'\n'}</Text>
          15 Rue d'Estienne d'Orves{'\n'}
          94220 Charenton-le-Pont, France{'\n'}
          contact@esportnews.fr
        </Paragraph>
      </Section>

      <Section title="Données collectées">
        <Paragraph>Lors de la création de votre compte :</Paragraph>
        <BulletPoint>Nom et prénom</BulletPoint>
        <BulletPoint>Adresse email</BulletPoint>
        <BulletPoint>Mot de passe (crypté)</BulletPoint>
        <BulletPoint>Photo de profil (optionnel)</BulletPoint>

        <Paragraph>Lors de l'utilisation :</Paragraph>
        <BulletPoint>Équipes favorites</BulletPoint>
        <BulletPoint>Préférences de notifications</BulletPoint>
        <BulletPoint>Historique de lecture (compteur uniquement)</BulletPoint>
        <BulletPoint>Statut d'abonnement Premium (actif/inactif)</BulletPoint>

        <InfoBox type="info">
          Les paiements de l'abonnement ESPORT NEWS Premium (0,99 €/mois) sont gérés exclusivement par Apple (App Store) ou Google (Google Play). Nous ne collectons ni ne stockons aucune donnée bancaire ou de paiement.
        </InfoBox>

        <InfoBox type="success">
          Nous ne collectons AUCUNE donnée de navigation comportementale à des fins publicitaires.
        </InfoBox>
      </Section>

      <Section title="Finalités du traitement">
        <Paragraph><Text style={{ fontWeight: '600' }}>Exécution du contrat :</Text></Paragraph>
        <BulletPoint>Gestion de votre compte</BulletPoint>
        <BulletPoint>Accès aux fonctionnalités</BulletPoint>
        <BulletPoint>Support technique</BulletPoint>

        <Paragraph><Text style={{ fontWeight: '600' }}>Consentement (facultatif) :</Text></Paragraph>
        <BulletPoint>Notifications push</BulletPoint>
        <BulletPoint>Newsletters par email</BulletPoint>
        <BulletPoint>Personnalisation des contenus</BulletPoint>
      </Section>

      <Section title="Vos droits RGPD">
        <BulletPoint><Text style={{ fontWeight: '600' }}>Droit d'accès</Text> - Obtenir une copie de vos données</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Droit de rectification</Text> - Corriger vos données</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Droit à l'effacement</Text> - Supprimer vos données</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Droit de portabilité</Text> - Récupérer vos données</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Droit d'opposition</Text> - Refuser certains traitements</BulletPoint>

        <InfoBox type="info">
          Pour exercer vos droits : contact@esportnews.fr{'\n'}
          Délai de réponse : 1 mois maximum
        </InfoBox>
      </Section>

      <Section title="Durée de conservation">
        <BulletPoint><Text style={{ fontWeight: '600' }}>Compte actif :</Text> Données conservées tant que le compte existe</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Compte inactif :</Text> Suppression après 3 ans d'inactivité</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Logs de sécurité :</Text> 12 mois maximum</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Factures :</Text> 10 ans (obligation légale)</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Données d'abonnement :</Text> Conservées pendant la durée de l'abonnement + 3 ans après résiliation</BulletPoint>
      </Section>

      <Section title="Sécurité">
        <Paragraph>
          Nous mettons en œuvre toutes les mesures techniques et organisationnelles pour protéger vos données :
        </Paragraph>
        <BulletPoint>Connexions HTTPS chiffrées</BulletPoint>
        <BulletPoint>Mots de passe hashés (bcrypt)</BulletPoint>
        <BulletPoint>Accès restreint aux données</BulletPoint>
        <BulletPoint>Serveur sécurisé en France</BulletPoint>
      </Section>

      <Section title="Cookies">
        <Paragraph>
          ESPORT NEWS utilise uniquement des cookies techniques strictement nécessaires (authentification, préférences).
        </Paragraph>
        <InfoBox type="success">
          ✅ Aucun cookie publicitaire tiers{'\n'}
          ✅ Aucun tracking comportemental
        </InfoBox>
      </Section>

      <Section title="Réclamation">
        <Paragraph>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).
        </Paragraph>
      </Section>
    </LegalPageTemplate>
  );
}
