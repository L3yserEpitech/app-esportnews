# Abonnement à une équipe — notifications de match

**Date** : 2026-08-10
**Statut** : validé, prêt pour le plan d'implémentation

## Intention

Suivre une équipe et recevoir une notification à chaque fois qu'elle joue, sans avoir à s'abonner match par match.

## Ce qui existe déjà

La moitié du besoin est couverte. Il ne reste que la partie notification.

| Élément | État |
|---|---|
| Cœur sur la page équipe (mobile) | existe — `app/team/[id].tsx`, `toggleFavorite` |
| Écran de liste des favoris | existe — `app/teams/index.tsx`, accessible depuis le profil |
| Stockage | existe — `users.favorite_teams` (`int[]` de pageids), plafonné à 3 |
| API | existe — `GET/POST/DELETE /api/users/favorite-teams` |
| Notification « match en direct » | existe — `buildStartNotification`, tick de 60 s |

Décision : on greffe les notifications sur les favoris plutôt que de créer une entité distincte. « Équipe favorite » signifie désormais « je suis notifié de ses matchs ».

## Contrainte structurante : on ne peut pas joindre par identifiant

Mesuré sur un payload réel (LCK 2026) :

| | T1 |
|---|---|
| `opponent.id` dans un match | `3752158250396943478` |
| pageid Liquipedia réel | `13637` |

`normalizeOpponents` fabrique l'id par `hashStringToInt(opp.Name)` (FNV-1a du **nom**, `team.go:528`). Il n'a aucun rapport avec le pageid stocké en favori.

Comparer les hashs reviendrait à comparer les noms, en version byte-exacte : une majuscule ou une espace de différence casserait le rapprochement. **On compare donc les noms directement**, normalisés (minuscules, espaces réduites).

Le template est écarté : il porte des suffixes de date (`t1 2019`, `gen.g esports 2026`, `drx 2026`) alors que `name` est déjà propre (`Fortress` là où le template vaut `fortress 2025`).

## Architecture

### Source des matchs

Le cache du poller, `liq:matches:upcoming:<wiki>`. Sa condition est `[[finished::0]] AND [[dateexact::1]] AND [[date::>now]]`, limite 5000, **sans borne haute** : il contient tous les matchs futurs du wiki.

Conséquence : **zéro appel Liquipedia**, le quota n'est pas touché.

Ce cache est fiable depuis le correctif `296a1474` (repli sur la copie `:stale`). Avant lui, un wiki sans trafic webhook servait une liste vide jusqu'à 32 min par heure — la détection aurait raté des matchs en silence.

### Rapprochement

1. Charger les utilisateurs **Premium** ayant au moins un favori.
2. Résoudre les pageids via `GetTeamsByPageIDs` (déjà en cache 6 h sous `liq:team:*`) → `name` + `current_videogame` → wiki. Dédupliquer les équipes partagées entre utilisateurs.
3. Par wiki concerné, lire le cache `upcoming` **une seule fois**.
4. Retenir les matchs dont un opponent porte le même nom normalisé, **et** dont `begin_at` tombe entre maintenant et maintenant + 7 jours.
5. Créer les `match_subscription` manquantes, marquées `from_team`.

Le cadrage par wiki écarte les homonymes : un « Fortress » LoL ne déclenche pas sur un « Fortress » CS.

Un favori dont le wiki ne peut pas être résolu (`current_videogame` absent) est ignoré et logué : sans wiki, on balaierait les dix caches et on rouvrirait le risque d'homonymie.

### Déclenchement

Un quatrième ticker dans `NotificationScheduler`, à **10 minutes**, calqué sur `hydrateTournamentMatches` (mêmes lecture groupée, déduplication et vérification d'existence avant création).

### Notification

**Aucune ligne neuve.** Le tick de 60 s existant prend le relais : `notified_start` comme anti-doublon, garde-fou de 3 h contre les rafales, deep link `m2` + `wiki`, purge à 7 jours.

Message inchangé :

> **Match en direct** — *T1 vs Gen.G commence maintenant !*

## Schéma

Une colonne : `from_team *int64` sur `match_subscription`, sur le modèle de `from_tournament`. Elle porte le **pageid de l'équipe favorite** à l'origine de la ligne, distingue les trois origines et permet de retirer les bonnes lignes.

## Règles

**Doublons** — la contrainte unique `(user_id, match_id)` garantit une seule ligne, donc une seule notification, quand un match est atteint par plusieurs chemins. Rien à coder, à condition de vérifier l'existence avant création comme le fait déjà l'hydratation tournoi.

**Retrait d'un favori** — supprimer les lignes `from_team` de cette équipe non encore notifiées. Une ligne portant aussi `from_tournament` survit.

**Fenêtre de 7 jours** — indispensable, le cache `upcoming` n'ayant pas de borne haute. Le passage tournant toutes les 10 min, la fenêtre avance seule : un match à trois semaines est pris quand il y entre.

**Premium** — seuls les utilisateurs Premium sont traités. Le même passage de 10 min **purge les lignes `from_team` non notifiées des utilisateurs qui ont perdu le statut**, sinon un ancien abonné continuerait d'être notifié : les lignes créées vivent leur vie et le tick de 60 s ne regarde pas le statut. La boucle de notification reste ainsi inchangée, sans coût sur le chemin critique.

Note : l'hydratation tournoi ignore déjà `FreeMatchSubLimit` (`Create` direct, `notification_scheduler.go:401`, sans le contrôle que fait le handler ligne 410). Le choix Premium rend la question sans objet pour les équipes.

## Interface

Rien à construire. Le cœur reste actif pour tous — c'est un marque-page — et une mention discrète indique que les notifications demandent Premium, avec lien vers l'écran d'abonnement existant. Le statut est déjà exposé par `useSubscription()` (`isSubscribed` = serveur **ou** achat IAP en session).

## Tests

La logique de rapprochement est pure et testable sans réseau, en payloads verbatim comme `liquipedia_bracket_test.go` :

- normalisation des noms (casse, espaces)
- cadrage par wiki (deux équipes homonymes sur des wikis différents)
- fenêtre de 7 jours (bornes incluses/exclues)
- pas de doublon quand un match est déjà couvert par un abonnement tournoi
- purge au retrait d'un favori : les lignes notifiées et celles d'une autre origine survivent
- purge à la perte du statut Premium

## Limite assumée

Si Liquipedia orthographie une équipe différemment entre sa fiche et un match, le match est raté **en silence**. Pour rendre ce trou visible, le passage logue les favoris n'ayant rien matché sur un cycle complet.
