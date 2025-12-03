#!/bin/bash

# Script pour tester l'envoi d'emails via webhook Stripe
# Simule un checkout.session.completed depuis Stripe

set -e

BACKEND_URL="http://localhost:4000"
WEBHOOK_SECRET="whsec_7bad10a0f993525696942ce4480a597a8f070acbfd6e423bb1e0bdceb171e0b4"

echo "════════════════════════════════════════════════════════════════"
echo "🧪 Test Email Sending via Webhook"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Create a sample checkout.session.completed event
echo "📧 Creating sample Stripe webhook event..."

# Payment intent ID (fake but realistic)
PAYMENT_INTENT_ID="pi_test_1234567890"
CUSTOMER_ID="cus_TXK3wGbhCDArzu"
SESSION_ID="cs_test_abcdef123456"
TIMESTAMP=$(date +%s)

# Create the webhook event payload
PAYLOAD=$(cat <<EOF
{
  "id": "evt_test_$TIMESTAMP",
  "object": "event",
  "api_version": "2023-10-16",
  "created": $TIMESTAMP,
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "$SESSION_ID",
      "object": "checkout.session",
      "after_expiration": null,
      "allow_promotion_codes": true,
      "amount_subtotal": 99,
      "amount_total": 99,
      "automatic_tax": {
        "enabled": false,
        "status": null
      },
      "billing_address_collection": null,
      "cancel_url": "http://localhost:3002/profile?section=subscription",
      "client_reference_id": null,
      "consent": null,
      "consent_collection": null,
      "currency": "eur",
      "customer": "$CUSTOMER_ID",
      "customer_creation": "if_required",
      "customer_details": null,
      "customer_email": "test@gmail.com",
      "expires_at": $((TIMESTAMP + 86400)),
      "livemode": false,
      "locale": null,
      "mode": "subscription",
      "payment_intent": "$PAYMENT_INTENT_ID",
      "payment_link": null,
      "payment_method_collection": "if_required",
      "payment_method_options": {},
      "payment_methods": [],
      "payment_status": "paid",
      "phone_number_collection": {
        "enabled": false
      },
      "recovered_from": null,
      "setup_intent": null,
      "status": "complete",
      "submit_type": null,
      "subscription": "sub_real_test_001",
      "success_url": "http://localhost:3002/profile?section=subscription",
      "total_details": {
        "amount_discount": 0,
        "amount_shipping": 0,
        "amount_tax": 0
      },
      "url": null
    }
  }
}
EOF
)

# Send the webhook event
echo "📤 Sending webhook to backend..."
echo ""

curl -X POST "$BACKEND_URL/api/webhooks/stripe" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=$TIMESTAMP,v1=test_signature" \
  -d "$PAYLOAD" \
  -v 2>&1 | grep -E "HTTP|received|email|Email|confirmation|Confirmation"

echo ""
echo ""
echo "✅ Webhook sent!"
echo ""
echo "Checking backend logs for email sending..."
sleep 2

docker-compose logs backend --tail=20 2>&1 | grep -i "email\|confirmation\|sent" || echo "No email logs found yet"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "💡 Check Resend Dashboard for sent emails:"
echo "https://dashboard.resend.com/emails"
echo "════════════════════════════════════════════════════════════════"
