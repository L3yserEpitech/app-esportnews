# Phase 5 — Live / Streams (remplacement SportDevs)

> **Statut : ✅ TERMINEE**
> **Pre-requis : Phase 2 terminee (matchs fonctionnels)**

## Objectif

S'assurer que les donnees live (matchs en cours, streams) fonctionnent correctement via Liquipedia. Cette phase est principalement une validation — si Phase 2 est bien faite, les matchs live sont deja servis par `/api/matches/running`. L'objectif est d'optimiser le cache, valider le carousel homepage, et nettoyer les dernieres references a SportDevs.

## Ce qui fonctionne deja (apres Phase 2)

| Fonctionnalite | Endpoint | Statut |
|----------------|----------|--------|
| Matchs en cours | `GET /api/matches/running` | Fonctionne via Liquipedia (Phase 2) |
| Alias live | `GET /api/live` | Alias de `/matches/running` (Phase 2) |
| Filtrage par jeu | `?game=valorant` | Fonctionne (Phase 2) |

## Ce qui reste a faire

### 1. Valider le cache live (adapte au rate limiting)

**Contrainte** : 60 req/jeu/heure. Un cache de 30s consommerait 120 req/heure → **impossible**.

**Solution** : Le poller background (Phase 1) rafraichit les matchs running toutes les **2 minutes**. Le cache Redis a un TTL de **3 minutes**. Les handlers lisent depuis Redis sans appeler l'API.

```go
// TTL adaptes au polling (PAS au cache-aside)
const (
    LiveMatchesCacheTTL = 3 * time.Minute    // Matchs running : 3 min (poller toutes les 2 min)
    MatchesCacheTTL     = 15 * time.Minute   // Autres matchs : 15 min
)
```

**Impact UX** : Les scores live sont rafraichis toutes les 2 minutes au lieu de 30 secondes. C'est un compromis acceptable avec 60 req/jeu/heure.

**Webhooks pour le live (recommande)** : Les webhooks LiquipediaDB envoient un event `edit` quand une page de match est modifiee (score MAJ, statut change). Le `WebhookHandler` (Phase 1) recoit l'event et fait 1 appel API cible pour rafraichir le cache Redis. Resultat : quasi-temps-reel sans polling intensif.

```
Score change sur Liquipedia
  → Webhook POST { page: "Match Page", wiki: "valorant", event: "edit" }
    → Backend fetch la page mise a jour (1 req)
      → Redis mis a jour
        → Prochain utilisateur voit le nouveau score
```

Avec les webhooks actifs, le poller des matchs running peut passer de **2 min a 5 min** (filet de securite), liberant du budget pour les requetes on-demand. Voir `docs/strategie-rate-limiting.md`.

### 2. Valider le carousel homepage

**Fichier** : `frontend/app/page.tsx`

Le carousel homepage charge les matchs live via :
```typescript
const matches = await liveMatchService.getLiveMatches(gameAcronym);
```

Ce service appelle `/api/matches/running` (via `matchService.getRunningMatches()`).

**Chaine d'appel :**
```
page.tsx
  → liveMatchService.getLiveMatches()    // frontend/app/services/liveMatchService.ts
    → matchService.getRunningMatches()    // frontend/app/services/matchService.ts
      → GET /api/matches/running          // backend Go
        → liquipediaService.GetRunningMatches()  // API Liquipedia
```

**Filtrage jeux bannis** : Le frontend filtre deja les jeux non supportes (Mobile Legends, StarCraft 2). Verifier que ce filtre fonctionne toujours avec les noms/slugs Liquipedia.

### 3. Composants live a valider

| Composant | Fichier | Ce qu'il affiche | Verifier |
|-----------|---------|-----------------|---------|
| `LiveMatchesCarousel` | `frontend/app/components/matches/LiveMatchesCarousel.tsx` | Carousel horizontal de matchs live | Affichage responsive (320px mobile, 350-380px desktop) |
| `LiveMatchCard` | `frontend/app/components/matches/LiveMatchCard.tsx` | Carte match individuelle | Status badge (LIVE rouge), equipes, scores, BO, streams |
| Homepage | `frontend/app/page.tsx` | Section matchs en direct | Chargement, filtrage par jeu, etat vide |

**Points a verifier sur `LiveMatchCard` :**
- Badge "LIVE" rouge s'affiche pour `status === "running"`
- Logos equipes chargent (URLs Liquipedia)
- Scores s'affichent (normalises depuis Liquipedia)
- Bouton "Regarder" ouvre le stream dans un nouvel onglet
- Format BO (BO1, BO3, BO5) s'affiche
- Games/maps s'affichent avec indicateurs de statut

### 4. Streams

**Structure attendue** : `streams_list[]` dans chaque match

```typescript
interface PandaStream {
  main: boolean;       // Stream principal ?
  language: string;    // "fr", "en", etc.
  embed_url: string;   // URL pour embed
  official: boolean;   // Stream officiel ?
  raw_url: string;     // URL directe (Twitch, YouTube)
}
```

**A verifier** : Comment Liquipedia structure les streams. Le normalizer (Phase 2) doit reconstruire `streams_list[]` au format ci-dessus.

- Si Liquipedia ne fournit pas d'URL embed → construire depuis l'URL raw (Twitch: `https://player.twitch.tv/?channel=xxx`, YouTube: `https://www.youtube.com/embed/xxx`)
- Si pas de stream disponible → `streams_list` vide `[]`

### 5. Nettoyer les references SportDevs restantes

**Fichiers avec references "SportDevs" (documentation uniquement) :**

| Fichier | Action |
|---------|--------|
| `CLAUDE.md` | Mettre a jour en Phase 6 |
| `VPS-SETUP-COMPLETE-GUIDE.md` | Retirer references SportDevs |
| `doc/IMPLEM_MOBILE.md` | Retirer references SportDevs |
| `mobile-app/types.ts` | Renommer commentaire "Live Match Types (from SportDevs)" → "Live Match Types (from Liquipedia)" |
| `mobile-app/PROGRESS.md` | Mettre a jour references |

> Note : Aucune reference SportDevs n'existe dans le code source actif (backend Go, frontend Next.js). Les references restantes sont uniquement dans la documentation.

### 6. Verifier le service legacy

**Fichier** : `frontend/app/services/liveMatchService.ts`

Ce fichier est un simple wrapper de compatibilite :
```typescript
// Re-exporte matchService comme liveMatchService
export { matchService as liveMatchService }
```

Aucun changement necessaire, mais verifier que tous les imports fonctionnent.

## Verification

- [ ] Carousel homepage affiche les matchs en cours avec donnees reelles Liquipedia
- [ ] `GET /api/live` retourne les memes donnees que `/api/matches/running`
- [ ] `GET /api/matches/running?game=lol` filtre correctement par jeu
- [ ] `LiveMatchCard` affiche : badge LIVE, equipes, logos, scores, BO, streams
- [ ] Bouton "Regarder" ouvre le stream dans un nouvel onglet
- [ ] Filtrage jeux bannis (Mobile Legends, StarCraft 2) fonctionne
- [ ] Cache Redis TTL = 3 min pour les matchs live, rafraichi par poller toutes les 2 min
- [ ] Etat vide affiche correctement quand aucun match n'est en cours
- [ ] Plus aucune reference a "SportDevs" dans le code source actif
- [ ] `grep -r "sportdevs" backend-go/ frontend/` → 0 resultats
- [ ] Documentation mise a jour (CLAUDE.md sera fait en Phase 6)

## Points d'attention

1. **60 req/jeu/heure** : Le poller consomme 30 req/heure/jeu pour les matchs running (2 min). C'est 50% du budget. Si les webhooks sont disponibles, les utiliser pour le live afin de liberer du budget.
2. **Delai 2 min** : Les scores live ont jusqu'a 2 min de retard. Compromis necessaire avec le quota actuel. Les webhooks resolvent ce probleme.
3. **Streams** : Si Liquipedia ne fournit pas les streams directement, il faudra peut-etre une source alternative ou accepter que certains matchs n'aient pas de lien stream.
4. **Jeux bannis** : Le filtre frontend utilise des noms/slugs de jeux. Verifier que les slugs Liquipedia correspondent a ceux utilises dans le filtre.
5. **Polling conditionnel** : Si aucun match live pour un jeu, le poller peut sauter le polling running et economiser 30 req/heure pour ce jeu.
6. **Mobile app** : `mobile-app/types.ts` a des types LiveMatch. Si l'app mobile consomme la meme API, elle beneficiera automatiquement des donnees Liquipedia.

## Dependances

- Phase 2 terminee (matchs fonctionnels avec streams normalises)
- Verifier la disponibilite des streams dans l'API Liquipedia
