# CLAUDE.md — Maquette (squelette)

> Ce document sert de source unique de vérité pour cadrer le produit, la DA, la structure du site et les exigences techniques. Il doit rester court par section, mais exhaustif par les rubriques.

---

## 1) Vision & Contexte

* **Pitch (1 phrase)** : Plateforme e-sport mettant en avant les matchs **en direct** (multi-jeux) + actualités, avec monétisation par publicités (masquées pour abonnés) et SEO solide sur les contenus éditoriaux.
* **Problème utilisateur** : Difficile de trouver rapidement les matchs live pertinents et les actus fiables par jeu.
* **Valeur clé / différenciation** : Focus **live-only** agrégé (SportDevs), tournois/équipes/matchs structurés (PandaScore), UX rapide par **jeu** et calendrier simple.
* **Mesure du succès (KPI)** : CTR jeux en home, temps sur « Direct », clics pubs, conversions abonnement (no-ads), pages vues News/Articles, retour visiteurs.
* **Contraintes business** : Pas de back-office à développer (déjà existant). Pas de conservation de données côté app. Pas de limite API contractuelle.
* **Backend** : Backend node présent dans /backend/api
**

### Décisions actées (20/09/2025)

* **Jeux au lancement** : Valorant, FIFA, Wild Rift, Dota, Overwatch, Call of Duty, League of Legends, Rainbow Six Siege, Rocket League, CS2.
* **Cibles** : Visuellement s’adresser aux **fans** ; **panneau publicitaire** pensé pour les joueurs.
* **Périmètre** : Pas de MVP — développement **complet** de l’app dès V1. Back-office **déjà fait**.
* **Sources de données** :

  * **SportDevs** → *uniquement* flux **en direct** + **news**.
  * **PandaScore** → tournois, équipes, matchs (hors live) et structure compétitions.
* **Données** : Aucune **conservation** locale (no persistence au-delà du cache volatile).
* **API** : Aucune limite de requêtes imposée.
* **Qualité des données** : Gestion des incohérences/doublons **plus tard** (hors V1).
* **Navigation** : Liens de diffusion **ouvrent dans un nouvel onglet**.
* **Monétisation** : 3 emplacements pub **desktop** dans une colonne droite pleine hauteur en home ; **aucune pub pour les abonnés**.
* **SEO** : H1/H2 optimisés ; articles avec **mots-clés** injectés automatiquement depuis la base de données.

## 5) Design & Direction Artistique (DA)

* **Intent** : priorité **fans** (lisibilité live, hiérarchie forte par jeu), codes visuels e-sport.
* **Design System** : tokens couleurs, typo, composants (Button, Card, Tabs jeux, Banner pub, LiveMatchItem).
* **Responsive** : Desktop sans bascule prématurée vers layout tablet quand on réduit la fenêtre.
* **Accessibilité** : WCAG 2.1 AA, focus visible, contraste OK.
* **Palette De Couleur** :#060B13, #091626, #182859, #F22E62

## 6) Contenus & SEO

* **SEO** : H1/H2/H3, meta Title/Description, OpenGraph. **Articles** : mots-clés auto depuis DB, champs éditoriaux existants via BO.
* **URLs** : slugs par jeu/compétition/article ; canonical sur listings avec filtres.
* **News** : une principale + liste ; règles d’épinglage via BO existant.
* **Charte éditoriale** : voix, tutoiement/vouvoiement, terminologie bannie/autorisé.
* **Modèle de page SEO** : Title (≤60), Meta description (≤155), H1–H3, schémas.
* **Stratégie mots-clés** : primaire / secondaires, intention.
* **Règles URL** : kebab-case, i18n, redirections (301/302), canonical.

## 7) Technique — Stack & Architecture

* **Données & APIs** :

  * **SportDevs** (live-only + news) → lecture en temps réel (polling court ou webhooks si dispo). Aucun stockage persistant ; **cache en mémoire**/CDN seulement.
  * **PandaScore** (tournois/équipes/matchs structurels) → hydratation des listes/fiche.
* **Stratégie data** : pas de base de données applicative pour persister ; prévoir **adapters** + **normalizers**; règles d’assainissement **post-V1**.
* **Infra** : CDN + edge cache ; SSR/ISR possible pour pages éditoriales (SEO), live en CSR.
* **Interop** : liens de diffusion ouverts en **new tab**.

## 9) Données & Contrats

* **Modèle logique (volatile)** : Game → Competition/Tournament → Match (live) → Streams ; News (source SportDevs) ; Article (via BO).
* **Politiques** : **Aucune rétention**. Pas de sauvegardes de données tierces. Seuls logs techniques non-PII.
* **RGPD** : abonnement géré côté BO/processor ; pubs conditionnées au consentement CMP.
* **Contrats d’API** : wrappers typed (OpenAPI/TypeScript), timeouts/retries, circuit-breaker.

## 10) Observabilité & Qualité Produit

* **Metrics** : Web Vitals (LCP<2.5s, CLS<0.1), temps de réponse APIs tierces, taux d’erreur fetch.
* **Alerting** : flux live down, dépassement temps réponse, anomalies volume.
* **Feature flags** : **no-ads** pour abonnés.
* **Logs** : structure JSON, corrélation traceId, pas de PII en clair.
* **Metrics** : RED/USE pour backend, Web Vitals pour frontend.
* **Alerting** : seuils, canaux, astreintes.
* **Feature flags** : rollout progressif, kill switch.

## 11) Analytics & Expérimentation

* **Plan de marquage (exemples)** : select\_game, view\_live\_list, open\_stream, click\_ad, view\_news, read\_article, subscribe\_noads.
* **Consentement** : déclenchement selon CMP.

### Shema database

create table public.users (
  id bigint generated by default as identity not null,
  created_at timestamp with time zone not null default now(),
  name text not null,
  email text not null,
  password text not null,
  avatar text null,
  admin boolean not null default false,
  favorite_teams integer[] null,
  notifi_push boolean null default false,
  notif_articles boolean null default false,
  notif_news boolean null default false,
  notif_matchs boolean null,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_id_key unique (id)
) TABLESPACE pg_default;

create table public.games (
  id bigint generated by default as identity not null,
  created_at time without time zone not null default now(),
  name text null,
  selected_image text null,
  unselected_image text null,
  acronym text null,
  full_name text null,
  constraint games_pkey primary key (id),
  constraint games_id_key unique (id)
) TABLESPACE pg_default;

create table public.articles (
  id bigint generated by default as identity not null,
  created_at timestamp with time zone not null default now(),
  slug text null,
  tags text[] null,
  title text null,
  views integer null default 0,
  author text null,
  content text null,
  category text null,
  subtitle text null,
  description text null,
  content_black text null,
  content_white text null,
  "featuredImage" text null,
  constraint articles_pkey primary key (id),
  constraint articles_id_key unique (id)
) TABLESPACE pg_default;

create table public.ads (
  id bigint generated by default as identity not null,
  created_at time without time zone not null default now(),
  title text null,
  position smallint null,
  type text null,
  url text null,
  redirect_link text null,
  constraint ads_pkey primary key (id),
  constraint ads_id_key unique (id)
) TABLESPACE pg_default;

- Demander dans le chat les endpoints des api quand il y'a besoin.
- Ne jamais mettre de données fictive SAUF si je te le dis.