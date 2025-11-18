#!/bin/bash

API_KEY="rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk"

echo "Testing different URL formats for PandaScore API..."

# Test 1: With brackets and comma
echo -e "\n=== Test 1: brackets + comma ==="
curl -s -H "Authorization: Bearer $API_KEY" "https://api.pandascore.co/matches?range%5Bbegin_at%5D=2025-11-18T00%3A00%3A00Z%2C2025-11-18T23%3A59%3A59Z&per_page=100" 2>&1 | head -c 200

# Test 2: Simple query without range
echo -e "\n\n=== Test 2: simple per_page only ==="
curl -s -H "Authorization: Bearer $API_KEY" "https://api.pandascore.co/matches?per_page=10" 2>&1 | jq 'length' 2>/dev/null

