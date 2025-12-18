Configuration Stripe (Dashboard Stripe)
A. Passer en mode Production
Activer le compte en production sur dashboard.stripe.com
Compléter les informations légales de ton entreprise
Ajouter un compte bancaire pour recevoir les paiements
Vérifier ton identité si demandé
Récupérer les clés API de production
Dashboard Stripe → Developers → API keys
Noter la Publishable key (commence par pk_live_...)
Noter la Secret key (commence par sk_live_...)
B. Créer les produits en production
Dashboard Stripe → Products → Create product
Créer le produit "Premium No-Ads" (ou nom de ton choix)
Ajouter un prix récurrent (ex: 4.99€/mois)
Noter le Price ID (commence par price_...)
C. Configurer le Webhook en production
Dashboard Stripe → Developers → Webhooks → Add endpoint
URL du webhook : https://ton-domaine.com/api/stripe/webhook
Événements à écouter :
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
Noter le Webhook signing secret (commence par whsec_...)
2. Backend Go - Configuration Production
Fichier .env (ou variables d'environnement Docker)

# Stripe Production Keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# URLs de redirection après paiement
STRIPE_SUCCESS_URL=https://esportnews.com/account?success=true
STRIPE_CANCEL_URL=https://esportnews.com/pricing?canceled=true
Code Backend (internal/handlers/stripe_handler.go)
Assure-toi que le handler utilise bien les variables d'env :

func NewStripeHandler() *StripeHandler {
    stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
    
    return &StripeHandler{
        secretKey:     os.Getenv("STRIPE_SECRET_KEY"),
        webhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
        priceID:       os.Getenv("STRIPE_PRICE_ID"),
    }
}
Routes à exposer

// Dans main.go ou routes.go
stripeHandler := handlers.NewStripeHandler()

e.POST("/api/stripe/create-checkout-session", stripeHandler.CreateCheckoutSession)
e.POST("/api/stripe/webhook", stripeHandler.HandleWebhook)
e.POST("/api/stripe/create-portal-session", stripeHandler.CreatePortalSession) // Pour gérer l'abonnement
3. Frontend - Configuration Production
Fichier .env.production

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_API_URL=https://api.esportnews.com
Composant React (exemple /app/pricing/page.tsx)

'use client';

import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`, // JWT token
        },
      });

      const { sessionId } = await response.json();
      const stripe = await stripePromise;
      
      await stripe?.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Erreur Stripe:', error);
      alert('Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleSubscribe} disabled={loading}>
      {loading ? 'Chargement...' : 'S\'abonner - 4.99€/mois'}
    </button>
  );
}
4. Dashboard Admin - Gestion des abonnements
A. Afficher le statut d'abonnement des utilisateurs
Ajouter une page /admin/users avec :

// Exemple structure
interface User {
  id: number;
  email: string;
  name: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: 'active' | 'canceled' | 'past_due' | null;
  subscription_ends_at?: string;
}
B. Endpoints backend nécessaires

// GET /admin/users - Liste des utilisateurs avec statut abonnement
// GET /admin/users/:id/subscription - Détails abonnement
// POST /admin/users/:id/cancel-subscription - Annuler un abonnement (admin)
C. Fonctionnalités admin recommandées
Voir la liste des abonnés actifs
Filtrer par statut (actif, annulé, impayé)
Voir l'historique des paiements
Annuler manuellement un abonnement (cas support client)
5. Base de données - Schéma utilisateurs
Ajouter colonnes à la table users :

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;

CREATE INDEX idx_users_stripe_customer ON public.users(stripe_customer_id);
CREATE INDEX idx_users_subscription_status ON public.users(subscription_status);
6. Déploiement - Checklist
Variables d'environnement Docker
Dans docker-compose.prod.yml :

services:
  backend:
    environment:
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - STRIPE_PRICE_ID=${STRIPE_PRICE_ID}
Tests avant mise en prod
✅ Tester le flux complet en mode test Stripe (clés pk_test_...)
✅ Vérifier que le webhook reçoit bien les événements (Stripe CLI : stripe listen --forward-to localhost:8080/api/stripe/webhook)
✅ Tester l'annulation d'abonnement
✅ Tester les paiements échoués (cartes test Stripe)
Passage en production
Remplacer toutes les clés test par les clés live
Mettre à jour l'URL du webhook dans Stripe Dashboard
Déployer le backend + frontend
Tester avec une vraie carte (petit montant)
Vérifier que le webhook est bien appelé (Stripe Dashboard → Webhooks → Logs)
7. Sécurité - Points critiques
Backend
✅ Vérifier la signature du webhook (stripe.ConstructEvent avec webhookSecret)
✅ Valider le JWT avant de créer une session Checkout
✅ Ne jamais exposer STRIPE_SECRET_KEY côté client
✅ Logger tous les événements webhook (pour debug)
Frontend
✅ Utiliser uniquement STRIPE_PUBLISHABLE_KEY (clé publique)
✅ Ne jamais stocker de données de carte côté client
✅ Rediriger vers Stripe Checkout (PCI-compliant)
8. Gestion des cas limites
Abonnement annulé
L'utilisateur garde l'accès jusqu'à subscription_ends_at
Après cette date, repasser en mode gratuit (popups ads visibles)
Paiement échoué
Stripe retry automatiquement 3 fois
Webhook invoice.payment_failed → envoyer email utilisateur
Après 3 échecs → subscription_status = 'past_due'
Remboursement
Gérer manuellement depuis Stripe Dashboard
Webhook charge.refunded → mettre à jour le statut utilisateur
Besoin d'aide pour implémenter une partie spécifique ? (backend handler, frontend component, migration DB, etc.)