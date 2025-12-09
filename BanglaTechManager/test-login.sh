#!/bin/bash

# Login Test Script
# Tests customer login with auto-provisioning

EMAIL="${1:-rahim.khan1@yahoo.com}"
PASSWORD="${2:-customer123}"
BASE_URL="${3:-http://localhost:5000}"

echo "=========================================="
echo "Customer Login Test"
echo "=========================================="
echo "Email: $EMAIL"
echo "Password: $PASSWORD"
echo "Base URL: $BASE_URL"
echo ""

echo "Step 1: Testing login..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Login successful!"
  echo ""
  echo "Response:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  
  TOKEN=$(echo "$BODY" | jq -r '.token' 2>/dev/null || echo "")
  
  if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo ""
    echo "Step 2: Testing protected endpoint (/api/customers/me)..."
    PROFILE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      "$BASE_URL/api/customers/me")
    
    PROFILE_CODE=$(echo "$PROFILE" | grep "HTTP_CODE" | cut -d: -f2)
    PROFILE_BODY=$(echo "$PROFILE" | sed '/HTTP_CODE/d')
    
    echo "HTTP Status: $PROFILE_CODE"
    if [ "$PROFILE_CODE" = "200" ]; then
      echo "✅ Profile access successful!"
      echo ""
      echo "Customer Profile:"
      echo "$PROFILE_BODY" | jq '.' 2>/dev/null || echo "$PROFILE_BODY"
    else
      echo "❌ Profile access failed!"
      echo "$PROFILE_BODY"
    fi
  fi
else
  echo "❌ Login failed!"
  echo ""
  echo "Response:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""
  echo "Troubleshooting:"
  echo "1. Check server is running: curl $BASE_URL/api/health"
  echo "2. Check server logs for [LOGIN] messages"
  echo "3. Verify email exists in customers table"
  echo "4. Try password: customer123"
fi

echo ""
echo "=========================================="

