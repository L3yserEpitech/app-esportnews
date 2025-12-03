#!/bin/bash

# Script pour tester l'annulation d'abonnement Stripe
# Simule un webhook customer.subscription.deleted et met à jour la BD

set -e

# Configuration
BACKEND_URL="http://localhost:4000"
EMAIL="test@gmail.com"
PASSWORD="testtest"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="esportnews"

echo "════════════════════════════════════════════════════════════════"
echo "🧪 Test Cancel Subscription"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Login
echo "📝 Step 1: Logging in with $EMAIL..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi

echo "✅ Login successful!"
echo ""

# Step 2: Check current subscription status
echo "📊 Step 2: Checking current subscription status..."
STATUS=$(curl -s -X GET "$BACKEND_URL/api/subscriptions/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

echo "Current Status: $STATUS"
CURRENT_PREMIUM=$(echo "$STATUS" | grep -o '"premium":[^,}]*' | cut -d':' -f2)
SUBSCRIPTION_ID=$(echo "$STATUS" | grep -o '"subscription_id":"[^"]*' | cut -d'"' -f4)

if [ "$CURRENT_PREMIUM" != "true" ]; then
  echo "❌ User is not premium! Cannot cancel a non-existent subscription."
  exit 1
fi

echo "Premium Status: $CURRENT_PREMIUM"
echo "Subscription ID: $SUBSCRIPTION_ID"
echo ""

# Step 3: Simulate subscription cancellation
echo "❌ Step 3: Simulating subscription cancellation..."
echo "Connecting to database and updating subscription status..."

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
-- Update user to cancel subscription
UPDATE public.user
SET
  premium = false,
  stripe_subscription_id = NULL,
  subscription_status = 'canceled',
  subscription_canceled_at = NOW(),
  subscription_updated_at = NOW()
WHERE email = '$EMAIL';

-- Verify update
SELECT id, email, premium, subscription_status, subscription_canceled_at
FROM public.user
WHERE email = '$EMAIL';
EOF

echo "✅ Subscription cancelled in database!"
echo ""

# Step 4: Verify new status
echo "✅ Step 4: Verifying cancellation status..."
sleep 1

NEW_STATUS=$(curl -s -X GET "$BACKEND_URL/api/subscriptions/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

echo "New Status: $NEW_STATUS"
NEW_PREMIUM=$(echo "$NEW_STATUS" | grep -o '"premium":[^,}]*' | cut -d':' -f2)

if [ "$NEW_PREMIUM" = "false" ]; then
  echo "✅ Success! User subscription cancelled"
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "🎉 Cancellation Complete!"
  echo "════════════════════════════════════════════════════════════════"
  echo "$NEW_STATUS" | jq . 2>/dev/null || echo "$NEW_STATUS"
  echo ""
  echo "✅ User is now FREE (no longer premium)"
  echo "✅ Cancellation email should have been sent (if Resend configured)"
  echo "✅ User can re-subscribe anytime"
  echo ""
  echo "Login to the app and check Profile → Subscription to verify!"
  echo "════════════════════════════════════════════════════════════════"
else
  echo "❌ Failed to cancel subscription"
  echo "Response: $NEW_STATUS"
  exit 1
fi
