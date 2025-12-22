import React from 'react';
import { LegalPageTemplate, Section, Paragraph, InfoBox } from '@/components/legal/LegalPageTemplate';
import { Text } from 'react-native-paper';

export default function MentionsLegalesScreen() {
  return (
    <LegalPageTemplate title="Mentions légales">
      <Section title="Éditeur">
        <Paragraph>
          <Text style={{ fontWeight: '600' }}>ESPORT NEWS</Text>{'\n'}
          Société par Actions Simplifiée (SAS){'\n'}
          Capital social : 1 000,00 €{'\n\n'}

          <Text style={{ fontWeight: '600' }}>Siège social :{'\n'}</Text>
          15 Rue d'Estienne d'Orves{'\n'}
          94220 Charenton-le-Pont, France{'\n\n'}

          <Text style={{ fontWeight: '600' }}>SIRET :</Text> 987 953 247{'\n'}
          <Text style={{ fontWeight: '600' }}>SIREN :</Text> 98795324700010{'\n'}
          <Text style={{ fontWeight: '600' }}>TVA :</Text> FR18987953247{'\n\n'}

          <Text style={{ fontWeight: '600' }}>Contact :{'\n'}</Text>
          contact@esportnews.fr
        </Paragraph>
      </Section>

      <Section title="Direction">
        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Directeur Général :{'\n'}</Text>
          Samuel Yaacov COHEN{'\n\n'}

          <Text style={{ fontWeight: '600' }}>Président de SAS :{'\n'}</Text>
          Kenan Clément Eliaou ALTARAC
        </Paragraph>
      </Section>

      <Section title="Hébergement">
        <Paragraph>
          Le site web et l'application mobile ESPORT NEWS sont hébergés par un prestataire technique indépendant en France.
        </Paragraph>
        <InfoBox type="success">
          Infrastructure hébergée sur un serveur privé virtuel (VPS) situé en France, garantissant la conformité avec les réglementations européennes (RGPD).
        </InfoBox>
      </Section>

      <Section title="Propriété intellectuelle">
        <Paragraph>
          Tous les contenus (textes, images, logos, vidéos, marques, scores, données) sont protégés par le droit d'auteur et le droit des bases de données.
        </Paragraph>
        <Paragraph>
          Toute reproduction ou réutilisation sans autorisation écrite est interdite.
        </Paragraph>
      </Section>

      <Section title="Données personnelles">
        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Responsable de traitement :{'\n'}</Text>
          ESPORT NEWS SAS{'\n\n'}

          Pour plus d'informations, consultez notre Politique de Confidentialité.
        </Paragraph>
      </Section>

      <Section title="Droit applicable">
        <Paragraph>
          Les présentes mentions légales sont régies par le droit français. Juridiction compétente : Créteil.
        </Paragraph>
      </Section>
    </LegalPageTemplate>
  );
}
