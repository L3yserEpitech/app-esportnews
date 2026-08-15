# Per-Game Pages — Phase 1 : Migration routing match — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer le détail match vers des URLs par jeu `/match/[game]/[id]` (corps générique pour tous les jeux), avec redirections 301 des anciennes URLs, liens internes et sitemap mis à jour.

**Architecture:** Next.js interdit deux noms de segment dynamique différents au même niveau ; on renomme donc le segment `app/match/[id]` → `app/match/[game]`. La **feuille** `app/match/[game]/page.tsx` devient un **résolveur de legacy** (reçoit l'ancien id, résout le wiki, redirige 308 vers la forme canonique). La route imbriquée `app/match/[game]/[id]/page.tsx` est le **nouveau détail par jeu** : il valide le slug, en déduit le wiki, fetch l'API en mono-wiki, et rend le client de détail existant (corps générique — la spécialisation par jeu arrive en Phase 2). Le composant client est déplacé dans un dossier privé partagé `app/match/_components/`.

**Tech Stack:** Next.js 15 App Router (Server Components, `permanentRedirect`/`notFound` de `next/navigation`), TypeScript, pnpm. Dépend de **Phase 0** (registre `app/lib/gameRegistry.ts`, helpers `app/lib/gameLinks.ts`).

**Référence spec:** `docs/superpowers/specs/2026-06-19-per-game-match-tournament-pages-design.md` §5, §10 (Phase 1).

**Pré-requis:** Plan Phase 0 exécuté et mergé (registre + helpers + `wiki` exposés).

---

## File Structure

| Fichier | Action |
|---------|--------|
| `frontend/app/match/_components/MatchDetailPageClient.tsx` | **Déplacer** depuis `app/match/[id]/MatchDetailPageClient.tsx` (dossier privé partagé) |
| `frontend/app/match/[id]/` → `frontend/app/match/[game]/` | **Renommer** le segment dynamique |
| `frontend/app/match/[game]/page.tsx` | **Réécrire** en résolveur de redirection legacy |
| `frontend/app/match/[game]/[id]/page.tsx` | **Créer** — détail match par jeu (corps générique) |
| `frontend/app/components/matches/LiveMatchCard.tsx` | **Modifier** — lien via `matchHref` |
| `frontend/app/components/matches/PandaMatchCard.tsx` | **Modifier** — lien via `matchHref` |
| `frontend/app/components/matches/FeaturedMatchCard.tsx` | **Modifier** — lien via `matchHref` |
| `frontend/app/components/tournaments/TournamentMatchCard.tsx` | **Modifier** — lien via `matchHref` |
| `frontend/app/components/tournaments/TournamentBracket.tsx` | **Modifier** — lien via `matchHref` |
| `frontend/app/sitemap-matches.xml/route.ts` | **Modifier** — URLs `/match/[slug]/[id]` |

> Note : tous les chemins ci-dessous contenant `[id]`/`[game]`/`[game]/[id]` sont des **dossiers Next.js** (crochets littéraux). Quoter dans le shell : `'app/match/[id]'`.

---

## Task 1 : Déplacer le client de détail dans un dossier privé partagé

Les deux routes (résolveur + détail imbriqué) doivent importer le même composant client. On le sort de `[id]/` vers `app/match/_components/` (le préfixe `_` exclut le dossier du routing). La profondeur relative reste identique (`[id]/` et `_components/` sont tous deux sous `app/match/`), donc **les imports internes du client ne changent pas**.

**Files:**
- Move: `frontend/app/match/[id]/MatchDetailPageClient.tsx` → `frontend/app/match/_components/MatchDetailPageClient.tsx`
- Modify: `frontend/app/match/[id]/page.tsx` (import du client)

- [ ] **Step 1 : Déplacer le fichier**

```bash
cd /Users/jules/Code/freelance/esportnews/frontend
mkdir -p app/match/_components
git mv 'app/match/[id]/MatchDetailPageClient.tsx' 'app/match/_components/MatchDetailPageClient.tsx'
```

- [ ] **Step 2 : Corriger l'import dans la page existante**

In `frontend/app/match/[id]/page.tsx`, remplacer la ligne d'import :
```tsx
import MatchDetailPageClient from './MatchDetailPageClient';
```
par :
```tsx
import MatchDetailPageClient from '../_components/MatchDetailPageClient';
```

- [ ] **Step 3 : Vérifier les types**

Run:
```bash
cd frontend && pnpm exec tsc --noEmit
```
Expected: aucune erreur (l'import résout vers le nouveau chemin).

- [ ] **Step 4 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add -A frontend/app/match
git commit -m "$(printf 'refactor(frontend): move MatchDetailPageClient to shared _components\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2 : Renommer le segment `[id]` → `[game]`

Next.js interdit `[id]` et `[game]` comme segments dynamiques frères. On renomme le dossier ; à ce stade `app/match/[game]/page.tsx` rend encore l'ancien détail (legacy continue de fonctionner). Il sera transformé en résolveur en Task 4, une fois la route canonique créée (Task 3).

**Files:**
- Rename: `frontend/app/match/[id]/` → `frontend/app/match/[game]/`

- [ ] **Step 1 : Renommer le dossier**

```bash
cd /Users/jules/Code/freelance/esportnews/frontend
git mv 'app/match/[id]' 'app/match/[game]'
```

- [ ] **Step 2 : Adapter le param dans `[game]/page.tsx`**

In `frontend/app/match/[game]/page.tsx`, le type des params change de `{ id }` à `{ game }`. Remplacer la signature et l'usage. Remplacer :
```tsx
interface MatchPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ wiki?: string }>;
}
```
par :
```tsx
interface MatchPageProps {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ wiki?: string }>;
}
```
Puis, dans `generateMetadata` et `MatchDetailPage`, remplacer les deux occurrences de :
```tsx
  const { id } = await params;
```
par :
```tsx
  const { game: id } = await params;
```
(on garde la variable locale `id` — la valeur du segment est encore l'ancien identifiant de match tant que cette page reste l'ancien détail.)

- [ ] **Step 3 : Vérifier les types**

Run:
```bash
cd frontend && pnpm exec tsc --noEmit
```
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add -A frontend/app/match
git commit -m "$(printf 'refactor(frontend): rename match [id] segment to [game]\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3 : Créer le détail par jeu `/match/[game]/[id]`

**Files:**
- Create: `frontend/app/match/[game]/[id]/page.tsx`

- [ ] **Step 1 : Créer la page de détail par jeu**

Create `frontend/app/match/[game]/[id]/page.tsx`:
```tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApiBaseUrl } from '../../../lib/apiConfig';
import { matchService } from '../../../services/matchService';
import { isValidSlug, slugToWiki } from '../../../lib/gameRegistry';
import MatchDetailPageClient from '../../_components/MatchDetailPageClient';

interface MatchPageProps {
  params: Promise<{ game: string; id: string }>;
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { game, id } = await params;
  const wiki = slugToWiki(game);
  if (!wiki) {
    return { title: 'Match | EsportNews', description: 'Détails du match en direct' };
  }

  try {
    const match = await matchService.getMatchById(id, wiki);
    if (!match) {
      return {
        title: 'Match non trouvé',
        description: "Le match que vous recherchez n'existe pas.",
      };
    }

    const homeTeam = match.opponents?.[0]?.opponent;
    const awayTeam = match.opponents?.[1]?.opponent;
    const title = `${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'} | ${match.videogame?.name || 'Esport'}`;
    const description = `${title} - ${match.league?.name || ''} - ${match.begin_at ? new Date(match.begin_at).toLocaleDateString('fr-FR') : ''}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
    const matchUrl = `${siteUrl}/match/${game}/${id}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: matchUrl,
        type: 'website',
        images: homeTeam?.image_url ? [{ url: homeTeam.image_url, width: 200, height: 200 }] : [],
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: homeTeam?.image_url ? [homeTeam.image_url] : [],
      },
      alternates: { canonical: matchUrl },
    };
  } catch (error) {
    console.error('Error generating metadata for match:', error);
    return { title: 'Match | EsportNews', description: 'Détails du match en direct' };
  }
}

export default async function MatchDetailPage({ params }: MatchPageProps) {
  const { game, id } = await params;
  if (!isValidSlug(game)) {
    notFound();
  }
  const wiki = slugToWiki(game)!;

  let response: Response | undefined;
  try {
    response = await fetch(
      `${getApiBaseUrl()}/api/matches/${encodeURIComponent(id)}?wiki=${encodeURIComponent(wiki)}`,
      { next: { revalidate: 60 } }
    );
  } catch {
    // Network/transient error — let the client component retry.
  }

  if (response?.status === 404) {
    notFound();
  }

  let initialMatch = null;
  if (response?.ok) {
    try {
      initialMatch = await response.json();
    } catch {
      // Malformed body — client handles the error state.
    }
  }

  return <MatchDetailPageClient matchId={id} wiki={wiki} initialMatch={initialMatch} />;
}
```

- [ ] **Step 2 : Build (vérifie l'absence de conflit de routing + les types)**

Run:
```bash
cd frontend && pnpm build
```
Expected: build réussi. **Aucune** erreur « You cannot use different slug names for the same dynamic path » (le segment legacy est `[game]`, le détail est `[game]/[id]` — cohérent).

- [ ] **Step 3 : Vérification manuelle (stack lancée)**

Avec backend + `pnpm dev` lancés :
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/match/valorant/<un_match2id_valorant_réel>"
```
Expected: `200`. Et un slug invalide :
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/match/inconnu/123"
```
Expected: `404`.

- [ ] **Step 4 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add 'frontend/app/match/[game]/[id]/page.tsx'
git commit -m "$(printf 'feat(frontend): per-game match detail route /match/[game]/[id]\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4 : Transformer la feuille `[game]/page.tsx` en résolveur de redirection legacy

Maintenant que la route canonique existe (Task 3), on remplace l'ancien détail mono-segment par un résolveur : il prend l'ancien id, résout le wiki via l'API, et redirige 308 vers `/match/<slug>/<id>`.

**Files:**
- Rewrite: `frontend/app/match/[game]/page.tsx`

- [ ] **Step 1 : Réécrire entièrement le fichier**

Replace the entire contents of `frontend/app/match/[game]/page.tsx` with:
```tsx
import { notFound, permanentRedirect } from 'next/navigation';
import { getApiBaseUrl } from '../../lib/apiConfig';
import { wikiToSlug, isValidSlug } from '../../lib/gameRegistry';

interface LegacyMatchProps {
  params: Promise<{ game: string }>;
}

// Legacy resolver. Old indexed URLs were single-segment /match/<id>; Next.js
// requires one slug name per level, so that id arrives here in the `game` param.
// We resolve the match's wiki and 308-redirect to the canonical
// /match/<slug>/<id>. A bare valid game slug (no id) goes to the matches list.
export default async function LegacyMatchRedirect({ params }: LegacyMatchProps) {
  const { game } = await params;

  // /match/valorant (a game, no id) → matches list.
  if (isValidSlug(game)) {
    permanentRedirect('/match');
  }

  const id = game; // legacy match id
  let response: Response | undefined;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/matches/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
  } catch {
    notFound();
  }

  if (!response || response.status === 404 || !response.ok) {
    notFound();
  }

  let match: { wiki?: string; match2id?: string; id?: number | string } | null = null;
  try {
    match = await response.json();
  } catch {
    notFound();
  }

  const slug = match?.wiki ? wikiToSlug(match.wiki) : undefined;
  if (!slug) {
    notFound();
  }

  const canonicalId = match?.match2id || id;
  permanentRedirect(`/match/${slug}/${canonicalId}`);
}
```

- [ ] **Step 2 : Build**

Run:
```bash
cd frontend && pnpm build
```
Expected: build réussi.

- [ ] **Step 3 : Vérification manuelle (stack lancée)**

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" "http://localhost:3000/match/<ancien_match2id>"
```
Expected: `308 -> http://localhost:3000/match/<slug>/<id>`.

- [ ] **Step 4 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add 'frontend/app/match/[game]/page.tsx'
git commit -m "$(printf 'feat(frontend): 308-redirect legacy /match/[id] to /match/[game]/[id]\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5 : Brancher les liens internes sur `matchHref`

Cinq composants construisent aujourd'hui le lien à la main. On les passe au helper `matchHref` (Phase 0) qui produit `/match/<slug>/<id>` (avec fallback legacy). Le changement est **identique** dans les cinq fichiers.

**Files (tous modifiés de la même façon) :**
- `frontend/app/components/matches/LiveMatchCard.tsx`
- `frontend/app/components/matches/PandaMatchCard.tsx`
- `frontend/app/components/matches/FeaturedMatchCard.tsx`
- `frontend/app/components/tournaments/TournamentMatchCard.tsx`
- `frontend/app/components/tournaments/TournamentBracket.tsx`

- [ ] **Step 1 : Dans CHACUN des 5 fichiers, ajouter l'import**

Ajouter en haut du fichier (avec les autres imports) :
```tsx
import { matchHref } from '../../lib/gameLinks';
```
(Les 5 composants sont à `app/components/matches/` ou `app/components/tournaments/` → la profondeur `../../lib/gameLinks` est correcte pour les cinq.)

- [ ] **Step 2 : Dans CHACUN des 5 fichiers, remplacer le href**

Remplacer :
```tsx
    <Link href={`/match/${match.match2id || match.id}${match.wiki ? `?wiki=${match.wiki}` : ''}`}>
```
par :
```tsx
    <Link href={matchHref(match)}>
```

- [ ] **Step 3 : Vérifier qu'il ne reste aucun lien construit à la main**

Run:
```bash
cd frontend && grep -rn '/match/\${' app/components/ || echo "OK: plus de href match construit à la main"
```
Expected: `OK: plus de href match construit à la main`.

- [ ] **Step 4 : Types + build**

Run:
```bash
cd frontend && pnpm exec tsc --noEmit
```
Expected: aucune erreur (les objets `match` portent bien `wiki`/`match2id`/`id`).

- [ ] **Step 5 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add frontend/app/components/matches frontend/app/components/tournaments
git commit -m "$(printf 'feat(frontend): route internal match links through matchHref\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6 : Mettre à jour le sitemap des matchs

On émet les URLs par jeu en réutilisant `matchHref` (logique testée en Phase 0), préfixées par `BASE_URL`.

**Files:**
- Modify: `frontend/app/sitemap-matches.xml/route.ts`

- [ ] **Step 1 : Importer le helper**

In `frontend/app/sitemap-matches.xml/route.ts`, ajouter en haut du fichier :
```ts
import { matchHref } from '../lib/gameLinks';
```

- [ ] **Step 2 : Construire les URLs par jeu**

Remplacer le bloc actuel :
```ts
  const urls = allMatches
    .map(
      (m) => `
  <url>
    <loc>${BASE_URL}/match/${m.id}</loc>
    <lastmod>${new Date(m.end_at || m.begin_at || Date.now()).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join('');
```
par :
```ts
  const urls = allMatches
    .map(
      (m) => `
  <url>
    <loc>${BASE_URL}${matchHref(m)}</loc>
    <lastmod>${new Date(m.end_at || m.begin_at || Date.now()).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join('');
```

- [ ] **Step 3 : Build**

Run:
```bash
cd frontend && pnpm build
```
Expected: build réussi.

- [ ] **Step 4 : Vérification manuelle (stack lancée)**

```bash
curl -s "http://localhost:3000/sitemap-matches.xml" | grep -o '<loc>[^<]*</loc>' | head -5
```
Expected: des `<loc>…/match/<slug>/<id></loc>` (ex. `/match/valorant/…`), plus aucune URL `/match/<id>` sans slug (pour les matchs ayant un `wiki`).

- [ ] **Step 5 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add frontend/app/sitemap-matches.xml/route.ts
git commit -m "$(printf 'feat(frontend): emit per-game match URLs in sitemap\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Vérification finale de la phase

- [ ] `cd frontend && pnpm build` → build complet OK (aucun conflit de slug, aucune erreur de type).
- [ ] `cd frontend && pnpm test` → les tests Phase 0 passent toujours (registre/helpers inchangés).
- [ ] Manuel (stack lancée) :
  - `/match/<slug>/<id>` → 200, page de détail (corps générique, identique à avant).
  - `/match/<ancien_id>` → 308 vers `/match/<slug>/<id>`.
  - `/match/inconnu/<id>` → 404.
  - Cartes de match (live, à venir, bracket) → cliquer mène vers `/match/<slug>/<id>`.
  - `sitemap-matches.xml` → URLs par jeu.

---

## Self-review (rempli)

- **Couverture spec (§5 routing, §10 SEO/migration)** : route par jeu ✅ (Task 3) · résolveur 308 legacy ✅ (Task 4) · liens internes via helper ✅ (Task 5) · sitemap ✅ (Task 6) · canonical par jeu ✅ (Task 3 metadata) · contrainte Next « un seul nom de slug par niveau » gérée ✅ (Tasks 2-4).
- **Placeholders** : aucun — code complet par étape, commandes exactes.
- **Cohérence des types** : `slugToWiki`/`wikiToSlug`/`isValidSlug` (Phase 0) utilisés en Tasks 3-4-6 ; `matchHref` (Phase 0) utilisé en Tasks 5-6 ; props `MatchDetailPageClient` (`matchId`, `wiki`, `initialMatch`) inchangées et réutilisées en Task 3 ; `matchService.getMatchById(id, wiki?)` signature respectée.
- **Corps générique** : Phase 1 rend le `MatchDetailPageClient` existant pour tous les jeux ; la spécialisation par jeu (registre de vues) est en Phase 2 — hors périmètre ici.
- **Non couvert (phases suivantes)** : vues match par jeu (Phase 2-3), tournois `/tournois/[game]/[id]` + sitemap tournois + liens `tournamentHref` (Phase 4).
```
