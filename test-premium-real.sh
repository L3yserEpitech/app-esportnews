#!/bin/bash

# Script pour tester le système d'abonnement avec un vrai customer Stripe
# Crée un vrai customer Stripe et simule un paiement réussi

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
echo "🧪 Test Premium Subscription with Real Stripe Customer"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Login
echo "📝 Step 1: Logging in..."
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

# Step 2: Create checkout session (creates real Stripe customer)
echo "💳 Step 2: Creating checkout session (generates real Stripe customer)..."
CHECKOUT_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/subscriptions/checkout" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

SESSION_URL=$(echo "$CHECKOUT_RESPONSE" | grep -o '"session_url":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_URL" ]; then
  echo "❌ Failed to create checkout session!"
  echo "Response: $CHECKOUT_RESPONSE"
  exit 1
fi

echo "✅ Checkout session created!"
echo "Session URL: $SESSION_URL"
echo ""

# Step 3: Get the real Stripe customer ID from database
echo "🔍 Step 3: Fetching real Stripe customer ID from database..."
CUSTOMER_ID=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT stripe_customer_id FROM public.user WHERE email = '$EMAIL';" | tr -d ' ')

if [ -z "$CUSTOMER_ID" ]; then
  echo "❌ Could not find Stripe customer ID"
  exit 1
fi

echo "✅ Found Stripe customer ID: $CUSTOMER_ID"
echo ""

# Step 4: Simulate successful payment by updating subscription data
echo "💰 Step 4: Simulating successful payment..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
-- Update user to premium status with REAL Stripe customer ID
UPDATE public.user
SET
  premium = true,
  stripe_subscription_id = 'sub_real_test_001',
  subscription_status = 'active',
  subscription_created_at = NOW(),
  subscription_updated_at = NOW(),
  subscription_current_period_start = NOW(),
  subscription_current_period_end = NOW() + INTERVAL '1 month'
WHERE email = '$EMAIL';

-- Verify update
SELECT id, email, premium, stripe_customer_id, subscription_status, subscription_current_period_end
FROM public.user
WHERE email = '$EMAIL';
EOF

echo "✅ Database updated!"
echo ""

# Step 5: Verify subscription status
echo "✅ Step 5: Verifying subscription status..."
sleep 1

STATUS=$(curl -s -X GET "$BACKEND_URL/api/subscriptions/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

echo "Status: $STATUS"
echo ""

# Step 6: Test the customer portal endpoint
echo "🌐 Step 6: Testing customer portal endpoint..."
PORTAL_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/subscriptions/portal" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

PORTAL_URL=$(echo "$PORTAL_RESPONSE" | grep -o '"portal_url":"[^"]*' | cut -d'"' -f4)

if [ -n "$PORTAL_URL" ]; then
  echo "✅ Customer portal URL generated successfully!"
  echo "Portal URL: $PORTAL_URL"
else
  echo "⚠️  Portal URL not generated"
  echo "Response: $PORTAL_RESPONSE"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🎉 Summary:"
echo "════════════════════════════════════════════════════════════════"
echo "✅ Email: $EMAIL"
echo "✅ Premium Status: true"
echo "✅ Stripe Customer ID: $CUSTOMER_ID"
echo "✅ Subscription Status: active"
echo ""
echo "You can now:"
echo "1️⃣  Login to the app with test@gmail.com / testtest"
echo "2️⃣  Go to Profile → Subscription"
echo "3️⃣  Click 'Gérer mon abonnement' (Manage subscription)"
echo "4️⃣  It should open the Stripe Customer Portal"
echo "════════════════════════════════════════════════════════════════"
