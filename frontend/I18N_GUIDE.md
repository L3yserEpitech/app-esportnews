# 🌍 Guide Multilinguisme (i18n) — EsportNews

## Vue d'ensemble

Votre site utilise **next-intl** pour gérer le multilinguisme de manière automatique et sans changement d'URL. Les langues supportées sont :

- 🇫🇷 Français (FR)
- 🇬🇧 English (EN)
- 🇪🇸 Español (ES)
- 🇩🇪 Deutsch (DE)
- 🇮🇹 Italiano (IT)

## Architecture

### 📁 Structure des fichiers

```
frontend/
├── public/locales/          # Fichiers de traductions JSON
│   ├── fr.json             # Traductions maître (français)
│   ├── en.json             # Traductions anglaises
│   ├── es.json             # Traductions espagnoles
│   ├── de.json             # Traductions allemandes
│   └── it.json             # Traductions italiennes
│
├── lib/
│   ├── preferences.ts      # Gestion cookies langue/thème
│   └── i18n.ts            # Configuration next-intl
│
├── middleware.ts           # Détection automatique de la langue
├── next.config.ts          # Configuration du plugin next-intl
│
└── app/
    ├── hooks/
    │   └── useI18n.ts     # Hook personnalisé pour traductions
    └── components/
        └── layout/
            └── SettingsModal.tsx  # Sélecteur de langue
```

## 🚀 Utilisation

### Option 1: Hook `useTranslations` (côté client)

Utilisez ce hook dans les composants client pour accéder aux traductions :

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations();

  return (
    <>
      <h1>{t('pages.home.actualite')}</h1>
      <p>{t('layout.navbar.accueil')}</p>
    </>
  );
}
```

### Option 2: Hook personnalisé `useI18n` (côté client)

Pour changer la langue dynamiquement :

```tsx
'use client';

import { useI18n } from '@/app/hooks/useI18n';

export default function LanguageSwitcher() {
  const { t, currentLocale, changeLanguage } = useI18n();

  return (
    <>
      <p>{t('layout.settings_modal.langue')}</p>
      <button onClick={() => changeLanguage('en')}>English</button>
      <button onClick={() => changeLanguage('fr')}>Français</button>
    </>
  );
}
```

### Option 3: `getTranslations` (côté serveur)

Pour les composants serveur :

```tsx
import { getTranslations } from 'next-intl/server';

export default async function MyServerComponent() {
  const t = await getTranslations();

  return <h1>{t('pages.home.actualite')}</h1>;
}
```

## 📝 Structure des clés de traduction

Les clés suivent une hiérarchie logique :

```json
{
  "layout": {
    "navbar": {
      "accueil": "Accueil",
      "actualites": "Actualités",
      ...
    },
    "settings_modal": {
      "langue": "Langue",
      "francais": "Français",
      ...
    }
  },
  "pages": {
    "login": {
      "connexion": "Connexion",
      ...
    }
  },
  "profile": {
    "preferences_section": {
      "langue": "Langue",
      ...
    }
  }
}
```

## 🔄 Détection automatique de la langue

La langue est détectée automatiquement par ordre de priorité :

1. **Cookie utilisateur** (`esport_language`) - Sauvegardé quand l'utilisateur change la langue
2. **Header Accept-Language** - Détecte la langue du navigateur
3. **Default** - Français (FR)

Le middleware (`middleware.ts`) gère cette logique automatiquement.

## ➕ Ajouter une nouvelle traduction

### 1. Ajouter la clé à `fr.json` (maître)

```json
{
  "layout": {
    "navbar": {
      "nouvelle_cle": "Nouveau texte français"
    }
  }
}
```

### 2. Ajouter la traduction dans les autres langues

Répétez le même chemin dans `en.json`, `es.json`, `de.json`, `it.json` :

```json
{
  "layout": {
    "navbar": {
      "nouvelle_cle": "New English text"
    }
  }
}
```

### 3. Utiliser dans un composant

```tsx
const t = useTranslations();
return <p>{t('layout.navbar.nouvelle_cle')}</p>;
```

## 🌐 Langue utilisateur et HTML lang

L'attribut `lang` du HTML est mis à jour automatiquement en fonction de la langue sélectionnée par l'utilisateur dans `layout.tsx`.

## 🎨 Sélecteur de langue dans l'UI

Le sélecteur de langue se trouve dans le composant `SettingsModal.tsx`. Les utilisateurs peuvent :

1. Cliquer sur l'icône ⚙️ (Paramètres) en haut à droite
2. Sélectionner une langue dans le dropdown
3. La préférence est sauvegardée automatiquement en cookie

## 💾 Persistance de la langue

La langue est sauvegardée dans un cookie avec les fonctions :

```typescript
// Récupérer la langue
const language = getLanguagePreference(); // Retourne: 'fr' | 'en' | 'es' | 'de' | 'it'

// Changer la langue
setLanguagePreference('en');
```

## ⚡ Performances

- **No API calls** - Les traductions sont dans des fichiers JSON statiques
- **Client & Server** - Fonctionne à la fois côté client et serveur
- **Zero layout shift** - Les traductions sont chargées avant le rendu
- **Fallback FR** - Si une traduction manque, elle utilise la version française

## 🔧 Configuration next-intl

La configuration se trouve dans `lib/i18n.ts` et `next.config.ts` :

```typescript
// lib/i18n.ts
export default getRequestConfig(async () => {
  const locale = getLanguagePreference();
  const messages = (await import(`../public/locales/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
```

## 📋 Checklist d'implémentation i18n

Quand vous ajoutez un nouveau composant avec du texte :

- [ ] Ajouter les clés à `public/locales/fr.json`
- [ ] Ajouter les traductions à `public/locales/{en,es,de,it}.json`
- [ ] Importer `useTranslations` du composant
- [ ] Remplacer textes hardcodés par `t('chemin.de.cle')`
- [ ] Tester avec toutes les langues via Settings

## 🐛 Dépannage

### La traduction ne s'affiche pas

1. Vérifier que la clé existe dans tous les fichiers JSON
2. Vérifier la syntaxe de la clé (ex: `t('layout.navbar.accueil')`)
3. Vérifier que `useTranslations` est importé depuis `next-intl`

### Changement de langue ne se reflète pas

1. Le changement de langue rechargera la page automatiquement
2. Vérifier que le cookie `esport_language` est sauvegardé
3. Vérifier la console pour les erreurs

## 📚 Ressources

- [Documentation next-intl](https://next-intl-docs.vercel.app/)
- [Guide de localisation Next.js](https://nextjs.org/docs/app/building-your-application/routing/internationalization)

---

**Version**: 1.0
**Dernière mise à jour**: 2025-11-07
**Langues supportées**: FR, EN, ES, DE, IT
