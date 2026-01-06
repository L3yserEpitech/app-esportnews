# Migration vers Webhooks Liquipedia (Future Implementation)

> **⚠️ Ce document décrit une implémentation future, pas encore d'actualité.**
> Actuellement, le backend utilise PandaScore avec appels à la demande + cache Redis 5 min.

---

## 🎯 Vue d'ensemble

**Objectif** : Remplacer l'approche actuelle (appels API à la demande avec cache) par un système **push** où Liquipedia nous notifie directement des changements.

**Contexte** : Liquipedia impose une limite de **60 requêtes/heure/endpoint/jeu**. Avec 10 jeux supportés et un système de polling, cette limite serait rapidement atteinte. Les webhooks permettent de recevoir uniquement les mises à jour nécessaires.

**⚠️ CONTRAINTE CRITIQUE** : Avec 60 req/h/endpoint/game, les utilisateurs ne peuvent **JAMAIS** déclencher d'appels API directs. Toute la logique de fetch doit être **backend-side** et proactive.

---

## 📋 Étapes principales

### **1️⃣ Configuration Liquipedia (côté externe)**

**Action** : S'inscrire au système de webhooks Liquipedia

- Contacter Liquipedia pour activer les webhooks sur votre compte API
- Leur fournir votre **URL publique** de webhook : `https://votredomaine.com/api/webhooks/liquipedia`
- Choisir les **événements** à recevoir :
  - `tournament.created`
  - `tournament.updated`
  - `match.created`
  - `match.updated`
  - `match.deleted`
- Configurer les **jeux** concernés (vos 10 jeux supportés)

**Résultat** : Liquipedia enverra des requêtes POST à votre endpoint à chaque modification.

---

### **2️⃣ Créer l'endpoint webhook (backend Go)**

**Fichier** : `/backend-go/internal/handlers/liquipedia_webhook.go`

**Ce qu'il fait** :
```go
POST /api/webhooks/liquipedia
├─ Reçoit JSON de Liquipedia
├─ Valide la signature (sécurité)
├─ Parse l'événement (type, game, resource_id)
└─ ⚠️ NE PAS JUSTE INVALIDER → Refetch IMMÉDIATEMENT les données (backend-side)
```

**IMPORTANT** : Contrairement à PandaScore, on ne peut pas se permettre d'invalider le cache et attendre qu'un utilisateur déclenche le refetch. Le webhook doit **proactivement** mettre à jour le cache.

**Exemple d'implémentation** :
```go
package handlers

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "net/http"

    "github.com/esportnews/backend/internal/cache"
    "github.com/labstack/echo/v4"
    "github.com/sirupsen/logrus"
)

type LiquipediaWebhookEvent struct {
    Type       string `json:"type"`        // "tournament.updated", "match.updated", etc.
    GameSlug   string `json:"game_slug"`   // "valorant", "lol", etc.
    ResourceID string `json:"resource_id"` // ID de la ressource modifiée
    Timestamp  string `json:"timestamp"`   // ISO 8601
}

type LiquipediaWebhookHandler struct {
    cache            *cache.RedisCache
    logger           *logrus.Logger
    webhookSecret    string
    liquipediaClient *liquipedia.Client  // Client pour refetch les données
}

func NewLiquipediaWebhookHandler(redisCache *cache.RedisCache, logger *logrus.Logger, secret string, client *liquipedia.Client) *LiquipediaWebhookHandler {
    return &LiquipediaWebhookHandler{
        cache:            redisCache,
        logger:           logger,
        webhookSecret:    secret,
        liquipediaClient: client,
    }
}

// ValidateSignature vérifie la signature HMAC envoyée par Liquipedia
func (h *LiquipediaWebhookHandler) ValidateSignature(body []byte, signature string) bool {
    mac := hmac.New(sha256.New, []byte(h.webhookSecret))
    mac.Write(body)
    expectedSignature := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expectedSignature), []byte(signature))
}

// HandleWebhook reçoit les notifications de mise à jour de Liquipedia
func (h *LiquipediaWebhookHandler) HandleWebhook(c echo.Context) error {
    // Lire le body brut pour validation
    bodyBytes, err := io.ReadAll(c.Request().Body)
    if err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid body"})
    }

    // Valider la signature
    signature := c.Request().Header.Get("X-Liquipedia-Signature")
    if !h.ValidateSignature(bodyBytes, signature) {
        h.logger.Warn("Invalid webhook signature received")
        return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid signature"})
    }

    // Parser l'événement
    var event LiquipediaWebhookEvent
    if err := json.Unmarshal(bodyBytes, &event); err != nil {
        h.logger.Errorf("Failed to parse Liquipedia webhook: %v", err)
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
    }

    // Log l'événement
    h.logger.Infof("Liquipedia webhook received: type=%s, game=%s, resource=%s",
        event.Type, event.GameSlug, event.ResourceID)

    // ⚠️ REFETCH IMMÉDIATEMENT (pas juste invalider)
    ctx := c.Request().Context()
    switch event.Type {
    case "tournament.updated", "tournament.created":
        // Refetch proactif en goroutine (pour répondre < 5s)
        go h.refreshTournamentCache(event.GameSlug)

    case "match.updated", "match.created":
        go h.refreshMatchCache(event.GameSlug)

    case "match.deleted":
        // Pour les suppressions, on peut juste invalider
        h.cache.Del(ctx, cache.LiquipediaMatchKey(event.ResourceID))
        h.cache.Del(ctx, cache.LiquipediaRunningMatchesKey(&event.GameSlug))

    default:
        h.logger.Warnf("Unknown webhook event type: %s", event.Type)
    }

    // Répondre rapidement (Liquipedia attend une réponse 200 sous 5s)
    return c.JSON(http.StatusOK, map[string]string{"status": "received"})
}

// refreshTournamentCache refetch proactivement les tournois (backend-side)
func (h *LiquipediaWebhookHandler) refreshTournamentCache(game string) {
    ctx := context.Background()

    statuses := []string{"running", "upcoming"}
    for _, status := range statuses {
        cacheKey := cache.LiquipediaTournamentsKey(game, status)

        // Fetch Liquipedia
        data, err := h.liquipediaClient.FetchTournaments(game, status)
        if err != nil {
            h.logger.Errorf("Failed to refresh %s/%s tournaments: %v", game, status, err)
            continue
        }

        // Update cache (2h TTL)
        h.cache.Set(ctx, cacheKey, data, 2*time.Hour)
        h.logger.Infof("Cache refreshed: %s/%s (webhook-triggered)", game, status)
    }
}

// refreshMatchCache refetch proactivement les matchs (backend-side)
func (h *LiquipediaWebhookHandler) refreshMatchCache(game string) {
    ctx := context.Background()
    cacheKey := cache.LiquipediaRunningMatchesKey(&game)

    // Fetch Liquipedia
    data, err := h.liquipediaClient.FetchMatches(game, "running")
    if err != nil {
        h.logger.Errorf("Failed to refresh %s running matches: %v", game, err)
        return
    }

    // Update cache (2h TTL)
    h.cache.Set(ctx, cacheKey, data, 2*time.Hour)
    h.logger.Infof("Cache refreshed: %s/running matches (webhook-triggered)", game)
}

// RegisterRoutes enregistre les routes webhook
func (h *LiquipediaWebhookHandler) RegisterRoutes(g *echo.Group) {
    webhooks := g.Group("/webhooks")
    webhooks.POST("/liquipedia", h.HandleWebhook)
}
```

**Pourquoi refetch proactif au lieu d'invalider ?**
- ❌ **Invalider uniquement** → Prochain utilisateur déclenche un appel API (consomme le rate limit)
- ✅ **Refetch backend-side** → Utilisateurs ne déclenchent JAMAIS d'appels API (économise le rate limit)
- Le cache est **toujours à jour** sans intervention utilisateur
- Pas besoin de stocker en base (architecture actuelle préservée)

---

### **3️⃣ Sécuriser le webhook**

**Problème** : N'importe qui pourrait envoyer de fausses requêtes à votre endpoint

**Solution** : Vérifier la signature HMAC envoyée par Liquipedia

```go
// Liquipedia signe chaque requête avec une clé secrète
func (h *WebhookHandler) ValidateSignature(body []byte, signature string) bool {
    mac := hmac.New(sha256.New, []byte(SECRET_KEY))
    mac.Write(body)
    expectedSig := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expectedSig), []byte(signature))
}
```

**Variables d'environnement à ajouter** :
```env
LIQUIPEDIA_WEBHOOK_SECRET=votre_cle_secrete_fournie_par_liquipedia
```

**Ajouter dans `/backend-go/internal/config/config.go`** :
```go
type Config struct {
    // ... existing fields
    LiquipediaWebhookSecret string `env:"LIQUIPEDIA_WEBHOOK_SECRET"`
}
```

---

### **4️⃣ Warm-up cache au démarrage**

**Problème** : Au démarrage, le cache est vide. Les premiers utilisateurs déclencheraient des appels API.

**Solution** : Pré-remplir le cache au démarrage du backend (warm-up proactif).

```go
// backend-go/cmd/server/main.go

func warmUpCache(client *liquipedia.Client, cache *cache.RedisCache, logger *logrus.Logger) {
    games := []string{"valorant", "lol", "cs2", "dota2", "overwatch", "fifa", "wildrift", "cod", "r6", "rocketleague"}
    statuses := []string{"running", "upcoming"}

    logger.Info("Starting cache warm-up...")

    for _, game := range games {
        for _, status := range statuses {
            cacheKey := cache.LiquipediaTournamentsKey(game, status)

            // Fetch Liquipedia
            data, err := client.FetchTournaments(game, status)
            if err != nil {
                logger.Errorf("Warm-up failed for %s/%s: %v", game, status, err)
                continue
            }

            // Populate cache (2h TTL)
            cache.Set(context.Background(), cacheKey, data, 2*time.Hour)
            logger.Infof("Warmed up: %s/%s", game, status)

            // Rate limit : 1 call/sec pour rester sous 60 req/h
            time.Sleep(1 * time.Second)
        }
    }

    logger.Info("Cache warm-up completed (20 calls in 20 sec)")
}

func main() {
    // ... init services ...

    // Warm-up cache au démarrage (goroutine pour ne pas bloquer)
    go warmUpCache(liquipediaClient, redisCache, logger)

    // Start server
    e.Start(":8080")
}
```

**Calcul** :
- 10 jeux × 2 statuses = 20 appels API
- 1 call/seconde = 20 secondes au démarrage
- **20 calls << 60 req/h** ✅ Rate limit respecté

---

### **5️⃣ Modifier les handlers d'API pour empêcher les appels directs**

**Problème** : Actuellement, `/api/tournaments` peut déclencher un fetch si cache expiré.

**Solution** : Les handlers doivent **TOUJOURS** servir depuis le cache, jamais d'appel API direct.

```go
// backend-go/internal/handlers/tournaments.go

const CacheTTL = 2 * time.Hour  // Cache long

func (h *TournamentHandler) GetTournaments(c echo.Context) error {
    game := c.QueryParam("game")
    status := c.QueryParam("status") // running, upcoming

    cacheKey := cache.LiquipediaTournamentsKey(game, status)

    // TOUJOURS servir depuis le cache
    cached, found := h.cache.Get(c.Request().Context(), cacheKey)
    if found {
        return c.JSON(http.StatusOK, cached)
    }

    // ⚠️ Cache MISS = ANOMALIE (ne devrait jamais arriver)
    h.logger.WithFields(logrus.Fields{
        "game":   game,
        "status": status,
    }).Error("Cache MISS on tournaments endpoint - data not warmed up")

    // Fallback : fetch mais logger comme erreur critique
    data, err := h.liquipediaClient.FetchTournaments(game, status)
    if err != nil {
        return c.JSON(http.StatusServiceUnavailable, map[string]string{
            "error": "Tournament data temporarily unavailable",
        })
    }

    // Cache pour éviter re-fetch
    h.cache.Set(c.Request().Context(), cacheKey, data, CacheTTL)

    // Alerter l'équipe (metrics/logs)
    h.metrics.CacheMissTotal.Inc()

    return c.JSON(http.StatusOK, data)
}
```

**Résultat** :
- ✅ Utilisateurs ne déclenchent JAMAIS d'appels API
- ✅ Cache MISS = alerté dans les logs (anomalie à investiguer)
- ✅ Fallback en cas d'urgence (mais loggé comme erreur)

---

### **6️⃣ Fallback si webhook échoue ou cache expire**

**Problème** : Si Liquipedia ne notifie pas ou si le cache expire (2h), les données deviennent obsolètes.

**Solution** : Cron job qui vérifie le TTL du cache et refresh proactivement avant expiration.

```go
// backend-go/internal/services/cache_manager.go

type CacheManager struct {
    cache            *cache.RedisCache
    liquipediaClient *liquipedia.Client
    logger           *logrus.Logger
}

// CheckAndRefreshCache vérifie TTL et refresh si < 10 min
func (m *CacheManager) CheckAndRefreshCache() {
    games := []string{"valorant", "lol", "cs2", "dota2", "overwatch", "fifa", "wildrift", "cod", "r6", "rocketleague"}
    statuses := []string{"running", "upcoming"}

    for _, game := range games {
        for _, status := range statuses {
            cacheKey := cache.LiquipediaTournamentsKey(game, status)

            // Vérifier TTL restant
            ttl := m.cache.TTL(context.Background(), cacheKey)

            // Si cache expire dans < 10 min → refresh proactif
            if ttl < 10*time.Minute {
                m.logger.Warnf("Cache expiring soon for %s/%s (TTL: %v), proactive refresh", game, status, ttl)
                m.refreshCache(game, status)
                time.Sleep(1 * time.Second) // Rate limit
            }
        }
    }
}

func (m *CacheManager) refreshCache(game, status string) {
    cacheKey := cache.LiquipediaTournamentsKey(game, status)

    data, err := m.liquipediaClient.FetchTournaments(game, status)
    if err != nil {
        m.logger.Errorf("Failed to refresh %s/%s: %v", game, status, err)
        return
    }

    m.cache.Set(context.Background(), cacheKey, data, 2*time.Hour)
    m.logger.Infof("Cache refreshed proactively: %s/%s", game, status)
}
```

**Cron setup dans main.go** :
```go
import "github.com/robfig/cron/v3"

func main() {
    // ... init services ...

    // Cron job : vérifier cache toutes les heures
    c := cron.New()
    cacheManager := services.NewCacheManager(redisCache, liquipediaClient, logger)

    c.AddFunc("0 * * * *", func() {  // Toutes les heures à la minute 0
        cacheManager.CheckAndRefreshCache()
    })

    c.Start()

    // Start server
    e.Start(":8080")
}
```

**Résultat** :
- ✅ Cache jamais expiré (refresh proactif avant expiration)
- ✅ Fonctionne même si webhooks échouent
- ✅ Max 20 calls/heure (1x vérification) << 60 req/h

---

### **7️⃣ Monitoring & Logs**

**À logger** :
- ✅ Webhook reçu (type, jeu, timestamp)
- ❌ Signature invalide (tentative de fraude)
- ⚠️ Événement inconnu (nouveau type non géré)
- 📊 Temps de traitement (doit être < 5 secondes)

**Exemple de logs** :
```go
h.logger.WithFields(logrus.Fields{
    "event_type": event.Type,
    "game":       event.GameSlug,
    "resource":   event.ResourceID,
    "timestamp":  event.Timestamp,
}).Info("Webhook processed successfully")
```

**Métriques Prometheus (optionnel)** :
```
webhooks_received_total (counter)
webhooks_processed_duration (histogram)
cache_invalidations_total (counter)
webhook_signature_failures_total (counter)
```

---

### **8️⃣ Tests**

#### **Test manuel (curl)**
```bash
# Simuler un webhook Liquipedia
curl -X POST http://localhost:8080/api/webhooks/liquipedia \
  -H "Content-Type: application/json" \
  -H "X-Liquipedia-Signature: sha256=SIGNATURE_CALCULEE" \
  -d '{
    "type": "tournament.updated",
    "game_slug": "valorant",
    "resource_id": "123456",
    "timestamp": "2025-12-11T10:00:00Z"
  }'
```

**Calculer la signature pour les tests** :
```bash
# Générer la signature HMAC avec votre secret
echo -n '{"type":"tournament.updated","game_slug":"valorant","resource_id":"123456","timestamp":"2025-12-11T10:00:00Z"}' | \
  openssl dgst -sha256 -hmac "votre_secret" | \
  awk '{print "sha256="$2}'
```

#### **Vérifications** :
1. Cache Redis invalidé ? → `redis-cli GET pandascore:tournaments:valorant:running` (doit être vide)
2. Log enregistré ? → Voir logs backend
3. Prochain appel frontend refetch ? → Tester dans le navigateur

#### **Tests unitaires (optionnel)** :
```go
func TestLiquipediaWebhookHandler_ValidateSignature(t *testing.T) {
    handler := &LiquipediaWebhookHandler{webhookSecret: "test_secret"}

    body := []byte(`{"type":"tournament.updated"}`)
    mac := hmac.New(sha256.New, []byte("test_secret"))
    mac.Write(body)
    validSig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

    assert.True(t, handler.ValidateSignature(body, validSig))
    assert.False(t, handler.ValidateSignature(body, "invalid_signature"))
}
```

---

## 🔄 Comparaison Avant/Après

### **Avant (PandaScore - polling + cache 5 min)**
```
User visite /tournois/valorant
  ↓
Frontend → Backend /api/tournaments?game=valorant
  ↓
Backend vérifie cache (5 min TTL)
  ├─ Cache HIT → Retourne données
  └─ Cache MISS → Appelle PandaScore → Cache → Retourne
```

**Problème** : Pas adapté à Liquipedia (60 req/h) → 100 users = 100 calls potentiels

---

### **Après (Liquipedia - webhooks + warm-up + cache 2h)**

#### **Démarrage**
```
Backend démarre
  ↓
Warm-up proactif : 10 jeux × 2 statuses = 20 calls en 20 sec
  ↓
Cache peuplé pour 2h
  ↓
Users arrivent → TOUJOURS cache HIT ✅
```

#### **Mise à jour de données**
```
Liquipedia détecte changement tournoi Valorant
  ↓
POST /api/webhooks/liquipedia {"type":"tournament.updated","game":"valorant"}
  ↓
Backend refetch IMMÉDIATEMENT (backend-side, pas user-triggered)
  ↓
Cache mis à jour (2h TTL reset)
  ↓
Prochain user → Cache HIT avec données fraîches ✅
```

#### **Fallback (si webhook échoue)**
```
Cron job vérifie TTL toutes les heures
  ↓
Si TTL < 10 min → Refresh proactif
  ↓
Cache jamais expiré ✅
```

**Avantages** :
- ✅ **0 appel API déclenché par les utilisateurs**
- ✅ Données toujours fraîches (webhooks temps réel)
- ✅ Respecte limite 60 req/h (~15 calls/h max)
- ✅ Self-healing si webhooks échouent (cron fallback)
- ✅ Pas de stockage persistant (architecture préservée)

---

## 📝 Checklist d'implémentation

### **Configuration externe**
- [ ] Contacter Liquipedia pour activer webhooks
- [ ] Obtenir clé secrète webhook (`LIQUIPEDIA_WEBHOOK_SECRET`)
- [ ] Fournir URL publique : `https://votredomaine.com/api/webhooks/liquipedia`

### **Backend - Webhook handler**
- [ ] Créer handler `liquipedia_webhook.go` avec refetch proactif
- [ ] Ajouter validation signature HMAC
- [ ] Ajouter config `LiquipediaWebhookSecret` dans `config.go`
- [ ] Router webhook dans `main.go`
- [ ] Implémenter `refreshTournamentCache()` et `refreshMatchCache()`

### **Backend - Warm-up & Cache**
- [ ] Créer fonction `warmUpCache()` dans `main.go`
- [ ] Allonger TTL cache : 5 min → 2h dans `cache/keys.go`
- [ ] Modifier handlers API pour empêcher fetch direct utilisateur
- [ ] Logger cache MISS comme anomalie critique

### **Backend - Fallback**
- [ ] Créer `CacheManager` avec méthode `CheckAndRefreshCache()`
- [ ] Ajouter cron job (1x/heure) pour vérifier TTL
- [ ] Refresh proactif si TTL < 10 min

### **Monitoring**
- [ ] Ajouter logs webhook reçus (type, jeu, resource)
- [ ] Logger signature invalide (tentative fraude)
- [ ] Métriques `cache_misses_total` (devrait être ~0)
- [ ] Métriques `webhooks_received_total`
- [ ] Alertes si cache MISS utilisateur > 5/jour

### **Tests**
- [ ] Tester webhook avec curl + signature HMAC
- [ ] Tester warm-up au démarrage (logs)
- [ ] Tester fallback cron (simuler cache expiré)
- [ ] Tester charge : 1000 users ne déclenchent aucun appel API

### **Production**
- [ ] Déployer backend avec nouvelles routes
- [ ] Vérifier URL publique accessible (ngrok pour dev)
- [ ] Configurer webhook chez Liquipedia
- [ ] Vérifier réception premier webhook réel
- [ ] Monitorer rate limit : doit rester < 60 req/h

---

## ⚠️ Points d'attention

1. **URL publique requise** : Votre backend doit être accessible depuis Internet (pas de localhost). Si vous êtes en local pour tester, utilisez **ngrok** ou **Cloudflare Tunnel**.
   ```bash
   # Exemple avec ngrok
   ngrok http 8080
   # Utiliser l'URL https://xxx.ngrok.io/api/webhooks/liquipedia
   ```

2. **Sécurité** : TOUJOURS vérifier la signature, sinon n'importe qui peut envoyer de fausses données.

3. **Timeout** : Liquipedia attend une réponse 200 sous 5 secondes. Utiliser `go` goroutine pour le refetch (pas dans le handler principal).

4. **Idempotence** : Liquipedia peut envoyer le même événement 2 fois. Refetch 2 fois = pas de problème (cache écrasé).

5. **Format de signature** : Vérifier avec Liquipedia le format exact (`X-Liquipedia-Signature`, `X-Hub-Signature`, etc.) et l'algorithme (SHA256, SHA1).

6. **Rate limit critique** : ⚠️ **Les utilisateurs ne doivent JAMAIS déclencher d'appels API**. Toute la logique doit être backend-side (webhooks + warm-up + cron).

7. **Cache TTL** : 2h est un bon compromis. Plus long = risque de données obsolètes si webhook échoue. Plus court = plus de refetch proactifs.

8. **Cron job fréquence** : 1x/heure suffit. Plus fréquent = gaspillage d'appels API. Moins fréquent = risque cache expiré.

9. **Monitoring essentiel** : Cache MISS utilisateur = bug critique à investiguer immédiatement.

10. **Consommation API cible** : ~15 calls/h en moyenne :
    - Warm-up : 20 calls au démarrage (amortis sur la journée)
    - Webhooks : 1-5 calls/h selon activité Liquipedia
    - Cron fallback : 0-10 calls/h (seulement si TTL < 10 min)

---

## 🔗 Ressources

- **Documentation Liquipedia API** : (à compléter avec le lien fourni par Liquipedia)
- **Email contact Liquipedia** : (adresse fournie dans l'email d'activation)
- **Package Go HMAC** : https://pkg.go.dev/crypto/hmac

---

## 📊 Résumé Architecture Finale

| Composant | Stratégie | Détails |
|-----------|-----------|---------|
| **Cache TTL** | 2 heures | Long pour éviter expiration entre webhooks |
| **Warm-up** | Au démarrage | 20 calls en 20 sec (10 jeux × 2 statuses) |
| **Webhook** | Refetch proactif | Backend fetch immédiatement, pas utilisateur |
| **Fallback** | Cron 1x/heure | Refresh si TTL < 10 min |
| **API Handlers** | Cache-only | JAMAIS d'appel direct, cache MISS = anomalie |
| **Rate Limit** | ~15 calls/h | << 60 req/h (marge de sécurité × 4) |
| **Consommation utilisateur** | 0 call | Toujours cache HIT |
| **Monitoring** | Logs + métriques | Cache MISS = alerte critique |

---

## 📅 Historique

- **2026-01-05** : Refonte complète du document pour gérer la contrainte **60 req/h/endpoint/jeu**. Ajout warm-up proactif, refetch backend-side, cron fallback, monitoring.
- **2025-12-11** : Création du document suite à l'analyse des contraintes de rate limit Liquipedia
