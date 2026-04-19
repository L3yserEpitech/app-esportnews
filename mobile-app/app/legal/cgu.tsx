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

      <Section title="Abonnement Premium">
        <Paragraph>
          <Text style={{ fontWeight: '600' }}>14.1 Description de l'abonnement{'\n'}</Text>
          ESPORT NEWS propose un abonnement auto-renouvelable intitulé ESPORT NEWS Premium, disponible sur iOS et Android.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>14.2 Tarif et durée{'\n'}</Text>
          Durée : 1 mois{'\n'}
          Prix : 0,99 € par mois (toutes taxes comprises)
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>14.3 Renouvellement automatique{'\n'}</Text>
          L'abonnement ESPORT NEWS Premium est automatiquement renouvelé chaque mois, sauf résiliation de votre part avant la fin de la période en cours. Le montant de 0,99 € est débité sur votre compte Apple ID ou Google Play selon votre plateforme, à chaque renouvellement.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>14.4 Comment annuler{'\n'}</Text>
          <Text style={{ fontWeight: '600' }}>Sur iOS (iPhone / iPad) :</Text>
        </Paragraph>
        <BulletPoint>Ouvrez Réglages</BulletPoint>
        <BulletPoint>Appuyez sur votre nom (Apple ID)</BulletPoint>
        <BulletPoint>Appuyez sur Abonnements</BulletPoint>
        <BulletPoint>Sélectionnez ESPORT NEWS Premium</BulletPoint>
        <BulletPoint>Appuyez sur Annuler l'abonnement</BulletPoint>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Sur Android :</Text>
        </Paragraph>
        <BulletPoint>Ouvrez le Google Play Store</BulletPoint>
        <BulletPoint>Appuyez sur votre photo de profil en haut à droite</BulletPoint>
        <BulletPoint>Appuyez sur Abonnements</BulletPoint>
        <BulletPoint>Sélectionnez ESPORT NEWS Premium</BulletPoint>
        <BulletPoint>Appuyez sur Annuler l'abonnement</BulletPoint>

        <InfoBox type="info">
          L'annulation prend effet à la fin de la période d'abonnement en cours. Vous conservez l'accès Premium jusqu'à cette date.
        </InfoBox>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>14.5 Politique de remboursement{'\n'}</Text>
          Conformément à la réglementation européenne (Directive 2011/83/UE), vous disposez d'un droit de rétractation de 14 jours à compter de la souscription de l'abonnement. Toutefois, en accédant immédiatement au contenu numérique, vous reconnaissez renoncer expressément à ce droit de rétractation.
        </Paragraph>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Sur iOS :</Text> les demandes de remboursement sont gérées par Apple. Rendez-vous sur reportaproblem.apple.com.</BulletPoint>
        <BulletPoint><Text style={{ fontWeight: '600' }}>Sur Android :</Text> les demandes de remboursement sont gérées par Google. Rendez-vous sur play.google.com/store/account/subscriptions.</BulletPoint>
      </Section>

      <Section title="Clauses spécifiques Apple (application iOS)">
        <Paragraph>
          Les présentes dispositions s'appliquent uniquement à l'application iOS d'ESPORT NEWS obtenue via l'Apple App Store. En cas de conflit entre cette section et toute autre disposition des présentes CGU concernant l'application iOS, la présente section prévaudra.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Reconnaissance{'\n'}</Text>
          Vous reconnaissez que les présentes CGU sont conclues uniquement entre vous et ESPORT NEWS, et non avec Apple Inc. ESPORT NEWS, et non Apple, est seule responsable de l'application iOS et de son contenu. Apple n'a aucune obligation de fournir un quelconque service de maintenance ou de support pour l'application.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Étendue de la licence{'\n'}</Text>
          La licence qui vous est accordée pour l'application iOS est une licence limitée, non transférable, d'utilisation de l'application sur tout produit de marque Apple que vous possédez ou contrôlez, dans les conditions prévues par les Règles d'utilisation (« Usage Rules ») des Apple Media Services Terms and Conditions. L'application peut être accédée et utilisée par d'autres comptes associés à l'acheteur via le Partage familial ou l'achat en volume.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Maintenance et support{'\n'}</Text>
          ESPORT NEWS est seule responsable de la fourniture des services de maintenance et de support relatifs à l'application iOS. Apple n'a aucune obligation de fournir des services de maintenance et de support pour l'application.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Garantie{'\n'}</Text>
          ESPORT NEWS est seule responsable des garanties produit, qu'elles soient expresses ou implicites en vertu de la loi, dans la mesure où elles ne sont pas valablement exclues. En cas de non-conformité de l'application iOS à toute garantie applicable, vous pouvez le notifier à Apple, qui vous remboursera le prix d'achat de l'application (le cas échéant). Dans toute la mesure permise par la loi applicable, Apple n'aura aucune autre obligation de garantie concernant l'application, et toute réclamation, perte, responsabilité, dommage, coût ou dépense imputable à un défaut de conformité à une garantie sera à la seule charge d'ESPORT NEWS.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Réclamations produit{'\n'}</Text>
          ESPORT NEWS, et non Apple, est responsable du traitement de toute réclamation formulée par vous ou un tiers concernant l'application iOS ou votre possession et/ou utilisation de celle-ci, y compris : (i) les réclamations en responsabilité du fait des produits ; (ii) toute réclamation selon laquelle l'application ne respecterait pas une exigence légale ou réglementaire applicable ; et (iii) les réclamations relatives à la protection des consommateurs, à la vie privée ou à toute législation similaire, y compris en lien avec l'utilisation par l'application des frameworks HealthKit et HomeKit, le cas échéant.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Droits de propriété intellectuelle{'\n'}</Text>
          En cas de réclamation d'un tiers alléguant que l'application iOS ou votre possession et utilisation de celle-ci porte atteinte à ses droits de propriété intellectuelle, ESPORT NEWS, et non Apple, sera seule responsable de l'enquête, de la défense, du règlement et de la décharge de toute réclamation pour contrefaçon.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Conformité légale{'\n'}</Text>
          Vous déclarez et garantissez que (i) vous ne vous trouvez pas dans un pays faisant l'objet d'un embargo du gouvernement des États-Unis ou désigné comme « pays soutenant le terrorisme » par ledit gouvernement ; et (ii) vous ne figurez sur aucune liste de parties interdites ou restreintes établie par le gouvernement des États-Unis.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Nom et coordonnées du développeur{'\n'}</Text>
          Toute question, plainte ou réclamation relative à l'application iOS doit être adressée à :{'\n'}
          ESPORT NEWS, 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France{'\n'}
          Téléphone : +33 7 69 36 08 84{'\n'}
          Email : juleslordet@proton.me
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Conditions des tiers{'\n'}</Text>
          Vous devez respecter les conditions applicables des tiers lorsque vous utilisez l'application iOS.
        </Paragraph>

        <Paragraph>
          <Text style={{ fontWeight: '600' }}>Tiers bénéficiaire{'\n'}</Text>
          Vous reconnaissez et acceptez qu'Apple et ses filiales sont des tiers bénéficiaires des présentes CGU, et qu'après votre acceptation des présentes, Apple aura le droit (et sera réputée avoir accepté ce droit) de faire appliquer les présentes CGU à votre encontre en tant que tiers bénéficiaire.
        </Paragraph>
      </Section>

      <Section title="Contact">
        <Paragraph>
          Pour toute question concernant les présentes CGU :{'\n'}
          Email : juleslordet@proton.me{'\n'}
          Téléphone : +33 7 69 36 08 84{'\n'}
          Courrier : ESPORT NEWS, 15 Rue d'Estienne d'Orves, 94220 Charenton-le-Pont, France
        </Paragraph>
      </Section>
    </LegalPageTemplate>
  );
}
