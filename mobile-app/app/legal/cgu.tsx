import React from 'react';
import { LegalPageTemplate, Section, Paragraph, BulletPoint, InfoBox } from '@/components/legal/LegalPageTemplate';
import { Text } from 'react-native-paper';

export default function CGUScreen() {
  return (
    <LegalPageTemplate title="Conditions d'Utilisation">
      <Section title="Objet">
        <Paragraph>
          ESPORT NEWS est une plateforme d'actualités esport proposant :
        </Paragraph>
        <BulletPoint>Matchs esport en direct (multi-jeux)</BulletPoint>
        <BulletPoint>Actualités et articles éditoriaux</BulletPoint>
        <BulletPoint>Informations sur les tournois et équipes</BulletPoint>
        <BulletPoint>Calendrier des matchs à venir</BulletPoint>
      </Section>

      <Section title="Accès à la plateforme">
        <Paragraph>
          La majorité des contenus est accessible gratuitement. Certaines fonctionnalités nécessitent la création d'un compte (gratuit).
        </Paragraph>
        <InfoBox type="info">
          Âge minimum : 13 ans{'\n'}
          Consentement parental requis pour les moins de 15 ans
        </InfoBox>
      </Section>

      <Section title="Compte utilisateur">
        <Paragraph><Text style={{ fontWeight: '600' }}>Vous vous engagez à :</Text></Paragraph>
        <BulletPoint>Fournir des informations exactes</BulletPoint>
        <BulletPoint>Protéger vos identifiants de connexion</BulletPoint>
        <BulletPoint>Ne créer qu'un seul compte par personne</BulletPoint>
        <BulletPoint>Nous informer en cas d'utilisation frauduleuse</BulletPoint>
      </Section>

      <Section title="Utilisation acceptable">
        <Paragraph><Text style={{ fontWeight: '600' }}>Il est interdit de :</Text></Paragraph>
        <BulletPoint>Utiliser la plateforme à des fins illégales</BulletPoint>
        <BulletPoint>Tenter d'accéder aux comptes d'autres utilisateurs</BulletPoint>
        <BulletPoint>Extraire massivement des données (scraping)</BulletPoint>
        <BulletPoint>Créer des comptes automatisés (bots)</BulletPoint>
        <BulletPoint>Publier du contenu illégal ou diffamatoire</BulletPoint>

        <InfoBox type="warning">
          Sanctions : avertissement, suspension ou suppression définitive du compte
        </InfoBox>
      </Section>

      <Section title="Propriété intellectuelle">
        <Paragraph>
          Tous les contenus (articles, images, design, code source) sont protégés par le droit d'auteur.
        </Paragraph>
        <Paragraph>
          L'utilisation vous confère uniquement un droit d'accès personnel et non commercial.
        </Paragraph>
      </Section>

      <Section title="Publicités">
        <Paragraph><Text style={{ fontWeight: '600' }}>Desktop :</Text> Bannières publicitaires visibles pour tous (y compris abonnés Premium)</Paragraph>
        <Paragraph><Text style={{ fontWeight: '600' }}>Mobile :</Text> Popups publicitaires désactivés pour les abonnés Premium uniquement</Paragraph>

        <InfoBox type="success">
          ✅ Publicités gérées en interne{'\n'}
          ✅ Aucun tracking publicitaire tiers{'\n'}
          ✅ Aucun cookie de ciblage
        </InfoBox>
      </Section>

      <Section title="Limitation de responsabilité">
        <Paragraph>
          ESPORT NEWS ne garantit pas :
        </Paragraph>
        <BulletPoint>Une disponibilité ininterrompue du service</BulletPoint>
        <BulletPoint>L'exactitude complète des données tierces (matchs, tournois)</BulletPoint>
        <BulletPoint>La responsabilité des contenus des streams externes</BulletPoint>
      </Section>

      <Section title="Droit applicable">
        <Paragraph>
          Les présentes CGU sont régies par le droit français. Juridiction compétente : Créteil.
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
