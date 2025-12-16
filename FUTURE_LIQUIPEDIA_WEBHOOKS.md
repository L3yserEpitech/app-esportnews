# Migration vers Webhooks Liquipedia (Future Implementation)

> **⚠️ Ce document décrit une implémentation future, pas encore d'actualité.**
> Actuellement, le backend utilise PandaScore avec appels à la demande + cache Redis 5 min.

---

## 🎯 Vue d'ensemble

**Objectif** : Remplacer l'approche actuelle (appels API à la demande avec cache) par un système **push** où Liquipedia nous notifie directement des changements.

**Contexte** : Liquipedia impose une limite de **60 requêtes/heure/endpoint/jeu**. Avec 10 jeux supportés et un système de polling, cette limite serait rapidement atteinte. Les webhooks permettent de recevoir uniquement les mises à jour nécessaires.

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
└─ Invalide le cache Redis correspondant
```

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
    cache         *cache.RedisCache
    logger        *logrus.Logger
    webhookSecret string
}

func NewLiquipediaWebhookHandler(redisCache *cache.RedisCache, logger *logrus.Logger, secret string) *LiquipediaWebhookHandler {
    return &LiquipediaWebhookHandler{
        cache:         redisCache,
        logger:        logger,
        webhookSecret: secret,
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

    // Invalider le cache correspondant pour forcer un refresh
    ctx := c.Request().Context()
    switch event.Type {
    case "tournament.updated", "tournament.created":
        // Invalider cache tournois pour ce jeu
        h.cache.Del(ctx, cache.PandaScoreTournamentsKey(event.GameSlug, "running"))
        h.cache.Del(ctx, cache.PandaScoreTournamentsKey(event.GameSlug, "upcoming"))
        h.cache.Del(ctx, cache.PandaScoreTournamentKey(event.ResourceID))
        h.logger.Infof("Cache invalidated for game %s tournaments", event.GameSlug)

    case "match.updated", "match.created":
        // Invalider cache matchs running
        h.cache.Del(ctx, cache.PandaScoreRunningMatchesKey(&event.GameSlug))
        h.cache.Del(ctx, cache.PandaScoreMatchKey(event.ResourceID))
        h.logger.Infof("Cache invalidated for game %s running matches", event.GameSlug)

    case "match.deleted":
        // Invalider cache match spécifique
        h.cache.Del(ctx, cache.PandaScoreMatchKey(event.ResourceID))
        h.cache.Del(ctx, cache.PandaScoreRunningMatchesKey(&event.GameSlug))
        h.logger.Infof("Cache invalidated for deleted match %s", event.ResourceID)

    default:
        h.logger.Warnf("Unknown webhook event type: %s", event.Type)
    }

    // Répondre rapidement (Liquipedia attend une réponse 200 sous 5s)
    return c.JSON(http.StatusOK, map[string]string{"status": "received"})
}

// RegisterRoutes enregistre les routes webhook
func (h *LiquipediaWebhookHandler) RegisterRoutes(g *echo.Group) {
    webhooks := g.Group("/webhooks")
    webhooks.POST("/liquipedia", h.HandleWebhook)
}
```

**Pourquoi invalider le cache ?**
- Quand Liquipedia dit "tournoi X mis à jour", on supprime le cache de ce tournoi
- Au prochain appel frontend, on refetch les données fraîches depuis Liquipedia
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

### **4️⃣ Gérer les événements par type**

**Mapping événement → action** :

| Événement Liquipedia | Action backend |
|---------------------|----------------|
| `tournament.created` | Invalider cache `tournaments/running` + `tournaments/upcoming` |
| `tournament.updated` | Invalider cache tournoi spécifique + listes |
| `match.created` | Invalider cache `matches/running` |
| `match.updated` | Invalider cache match spécifique |
| `match.deleted` | Invalider cache + liste matchs |

**Code exemple** :
```go
switch event.Type {
case "tournament.updated":
    // Invalider cache tournoi individuel
    cache.Del(ctx, "pandascore:tournament:" + event.ResourceID)
    // Invalider listes (running/upcoming)
    cache.Del(ctx, "pandascore:tournaments:valorant:running")

case "match.updated":
    cache.Del(ctx, "pandascore:match:" + event.ResourceID)
    cache.Del(ctx, "pandascore:matches:running:valorant")
}
```

---

### **5️⃣ Enregistrer le handler dans main.go**

**Ajouter dans `/backend-go/cmd/server/main.go`** :

```go
// Initialize Liquipedia webhook handler
liquipediaWebhookHandler := handlers.NewLiquipediaWebhookHandler(
    redisClient,
    logger,
    cfg.LiquipediaWebhookSecret,
)

// Register webhook routes (public, no auth required)
liquipediaWebhookHandler.RegisterRoutes(apiGroup)
```

---

### **6️⃣ Fallback si webhook échoue**

**Problème** : Si Liquipedia a une panne, vous ne recevez plus de mises à jour

**Solution** : Garder un **polling léger de secours** (20-30 min) uniquement pour les données critiques

```go
// Cron job toutes les 30 min (fallback)
// Seulement si aucun webhook reçu dans les 30 dernières minutes
if time.Since(lastWebhookTime) > 30*time.Minute {
    RefreshCriticalData() // Polling manuel
}
```

**Implémentation suggérée** :
- Stocker timestamp du dernier webhook dans Redis : `SET last_webhook_timestamp <unix_time>`
- Cronjob (package `github.com/robfig/cron/v3`) qui vérifie toutes les 30 min
- Si `last_webhook_timestamp` > 30 min, déclencher un refresh manuel

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

### **Avant (polling à la demande + cache)**
```
User visite /tournois/valorant
  ↓
Frontend → Backend /api/tournaments?game=valorant
  ↓
Backend vérifie cache (5 min TTL)
  ├─ Cache HIT → Retourne données
  └─ Cache MISS → Appelle Liquipedia → Cache → Retourne
```

**Problème** : Si 100 users visitent en 1h → potentiellement 100 appels Liquipedia (si cache expiré)

### **Après (webhooks)**
```
Liquipedia détecte changement tournoi Valorant
  ↓
POST /api/webhooks/liquipedia {"type":"tournament.updated","game":"valorant"}
  ↓
Backend invalide cache Redis
  ↓
Prochain user → Cache MISS → Appelle Liquipedia UNE FOIS → Cache 5 min
```

**Avantages** :
- ✅ 1 seul appel API même avec 1000 users
- ✅ Données toujours fraîches (notifiées en temps réel)
- ✅ Respecte limite 60 req/h (car pas de polling)

---

## 📝 Checklist d'implémentation

- [ ] Contacter Liquipedia pour activer webhooks
- [ ] Obtenir clé secrète webhook (`LIQUIPEDIA_WEBHOOK_SECRET`)
- [ ] Créer handler `liquipedia_webhook.go`
- [ ] Ajouter validation signature HMAC
- [ ] Ajouter config `LiquipediaWebhookSecret` dans `config.go`
- [ ] Router webhook dans `main.go`
- [ ] Mapper événements → invalidations cache
- [ ] Ajouter logs/monitoring
- [ ] Tester avec curl (simulation locale)
- [ ] Déployer en production
- [ ] Configurer URL webhook publique chez Liquipedia
- [ ] Vérifier réception premier webhook réel
- [ ] (Optionnel) Ajouter fallback polling 30 min
- [ ] (Optionnel) Ajouter métriques Prometheus

---

## ⚠️ Points d'attention

1. **URL publique requise** : Votre backend doit être accessible depuis Internet (pas de localhost). Si vous êtes en local pour tester, utilisez **ngrok** ou **Cloudflare Tunnel**.
   ```bash
   # Exemple avec ngrok
   ngrok http 8080
   # Utiliser l'URL https://xxx.ngrok.io/api/webhooks/liquipedia
   ```

2. **Sécurité** : TOUJOURS vérifier la signature, sinon n'importe qui peut envoyer de fausses données.

3. **Timeout** : Liquipedia attend une réponse 200 sous 5 secondes. Invalidation cache = rapide ✅, mais ne faites PAS de traitement lourd dans le webhook.

4. **Idempotence** : Liquipedia peut envoyer le même événement 2 fois. Votre code doit gérer ça (invalider cache 2 fois = pas de problème).

5. **Format de signature** : Vérifier avec Liquipedia le format exact (`X-Liquipedia-Signature`, `X-Hub-Signature`, etc.) et l'algorithme (SHA256, SHA1).

6. **Rate limit toujours actif** : Même avec webhooks, la limite 60 req/h s'applique aux appels manuels (quand cache expiré). Prévoir un système de retry avec backoff exponentiel.

---

## 🔗 Ressources

- **Documentation Liquipedia API** : (à compléter avec le lien fourni par Liquipedia)
- **Email contact Liquipedia** : (adresse fournie dans l'email d'activation)
- **Package Go HMAC** : https://pkg.go.dev/crypto/hmac

---

## 📅 Historique

- **2025-12-11** : Création du document suite à l'analyse des contraintes de rate limit Liquipedia (60 req/h/endpoint/jeu)
