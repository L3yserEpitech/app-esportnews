import React from 'react';
import { LegalPageTemplate, Section, Paragraph, BulletPoint, InfoBox } from '@/components/legal/LegalPageTemplate';
import { Text } from 'react-native-paper';

export default function CookiesScreen() {
  return (
    <LegalPageTemplate title="Politique Cookies">
      <Section title="Qu'est-ce qu'un cookie ?">
        <Paragraph>
          Un cookie est un petit fichier texte stocké sur votre appareil lors de votre visite. Il permet au site de mémoriser vos actions et préférences.
        </Paragraph>
      </Section>

      <Section title="Cookies utilisés">
        <Paragraph><Text style={{ fontWeight: '600' }}>Cookies strictement nécessaires :</Text></Paragraph>
        <BulletPoint><Text style={{ fontWeight: '600' }}>auth_token</Text> - Session utilisateur authentifiée (supprimé à la déconnexion)</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>csrf_token</Text> - Protection contre les attaques CSRF (sécurité)</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>subscription_status</Text> - Statut abonnement Premium (30 jours)</BulletPoint>

        <InfoBox type="success">
          ✅ Ces cookies sont indispensables au fonctionnement{'\n'}
          ✅ Aucun consentement n'est requis (cookies techniques)
        </InfoBox>

        <Paragraph><Text style={{ fontWeight: '600' }}>Cookies de personnalisation :</Text></Paragraph>
        <BulletPoint><Text style={{ fontWeight: '600' }}>selected_game</Text> - Dernier jeu consulté (30 jours)</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>notification_settings</Text> - Préférences de notifications (1 an)</BulletPoint>
      </Section>

      <Section title="Ce que nous N'utilisons PAS">
        <InfoBox type="success">
          ✅ AUCUN cookie publicitaire tiers{'\n'}
          ✅ AUCUN tracking comportemental{'\n'}
          ✅ AUCUN ciblage publicitaire{'\n'}
          ✅ PAS de Google AdSense / Meta Ads{'\n'}
          ✅ PAS de cookies de régies publicitaires
        </InfoBox>

        <Paragraph>
          Nous gérons nos publicités en interne avec de simples images statiques, sans déposer de cookies tiers sur votre appareil.
        </Paragraph>
      </Section>

      <Section title="Finalités">
        <Paragraph>Nous utilisons des cookies pour :</Paragraph>
        <BulletPoint>Assurer le fonctionnement du site (authentification, sécurité)</BulletPoint>
        <BulletPoint>Mémoriser vos préférences (jeu favori, équipes suivies)</BulletPoint>
        <BulletPoint>Améliorer votre expérience utilisateur</BulletPoint>
        <BulletPoint>Mesurer les performances techniques (pas de tracking utilisateur)</BulletPoint>
      </Section>

      <Section title="Comptage de vues">
        <Paragraph>
          Notre système incrémente simplement un compteur de vues par article. Il s'agit d'une métrique technique, pas d'un tracking utilisateur.
        </Paragraph>
        <InfoBox type="info">
          ✅ Aucun stockage d'historique utilisateur{'\n'}
          ✅ Aucun profilage comportemental{'\n'}
          ✅ Pas de consentement requis
        </InfoBox>
      </Section>

      <Section title="Publicités internes">
        <Paragraph><Text style={{ fontWeight: '600' }}>Desktop :</Text> Bannières publicitaires visibles pour tous (colonne droite)</Paragraph>
        <Paragraph><Text style={{ fontWeight: '600' }}>Mobile :</Text> Popups désactivés pour abonnés Premium uniquement</Paragraph>

        <InfoBox type="success">
          Les publicités affichées sont de simples images/vidéos fournies par nos partenaires commerciaux. Aucun cookie publicitaire n'est déposé.
        </InfoBox>
      </Section>

      <Section title="Durées de conservation">
        <BulletPoint><Text style={{ fontWeight: '600' }}>Cookies de session :</Text> Supprimés à la fermeture de l'app</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Cookies fonctionnels :</Text> Maximum 12 mois</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Cookies de personnalisation :</Text> Maximum 12 mois</BulletPoint>
      </Section>

      <Section title="Gérer vos préférences">
        <Paragraph>
          Les cookies strictement nécessaires ne peuvent pas être désactivés (authentification, sécurité).
        </Paragraph>
        <Paragraph>
          Pour les cookies de personnalisation, vous pouvez effacer les données de l'application depuis les paramètres de votre appareil.
        </Paragraph>

        <InfoBox type="info">
          <Text style={{ fontWeight: '600' }}>iOS :</Text> Réglages → ESPORT NEWS → Effacer les données{'\n\n'}
          <Text style={{ fontWeight: '600' }}>Android :</Text> Paramètres → Apps → ESPORT NEWS → Stockage → Effacer les données
        </InfoBox>
      </Section>

      <Section title="Vos droits">
        <Paragraph>
          Conformément au RGPD, vous disposez des droits d'accès, rectification, effacement et opposition concernant vos données.
        </Paragraph>
        <Paragraph>
          Pour plus d'informations, consultez notre Politique de Confidentialité.
        </Paragraph>
      </Section>

      <Section title="Modifications">
        <Paragraph>
          Nous nous réservons le droit de modifier cette politique à tout moment. Toute modification substantielle vous sera notifiée.
        </Paragraph>
      </Section>

      <Section title="Contact">
        <Paragraph>
          Pour toute question : contact@esportnews.fr
        </Paragraph>
      </Section>
    </LegalPageTemplate>
  );
}
