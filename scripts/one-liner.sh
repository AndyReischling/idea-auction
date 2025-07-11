#!/bin/bash

# Firestore cURL helper – direct writes / reads
# -------------------------------------------------------------
# Minimal example that shows how to create / list / delete
# Firestore **documents** using the REST API and `curl`.
# No references to browser localStorage remain: this is a pure
# backend‑style snippet you can run from any shell.

# ─────────────────────────────────────────────────────────────
# ⚙️  Config – set these before running
# ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No colour

if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
  echo -e "${RED}❌ FIREBASE_PROJECT_ID is required${NC}"
  echo "export FIREBASE_PROJECT_ID=your‑project‑id"
  exit 1
fi

if [[ -z "$FIREBASE_ID_TOKEN" ]]; then
  echo -e "${YELLOW}⚠️  FIREBASE_ID_TOKEN not set – requests will fail${NC}"
  echo "Run in the browser console:"
  echo "  firebase.auth().currentUser.getIdToken().then(t => copy(t))"
  echo "Then: export FIREBASE_ID_TOKEN=PASTE_TOKEN_HERE"
  echo ""
fi

# ─────────────────────────────────────────────────────────────
# 📦 Example payload – a simple document for `/demo_items`
# ─────────────────────────────────────────────────────────────
EXAMPLE_DOC_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
FIRESTORE_ENDPOINT="https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT_ID/databases/(default)/documents"
COLLECTION="demo_items"

read -r -d '' EXAMPLE_JSON << EOF
{
  "fields": {
    "uid":            {"stringValue": "$EXAMPLE_DOC_ID"},
    "title":          {"stringValue": "Hello from curl"},
    "createdAt":      {"timestampValue": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"},
    "isImportedCLI":  {"booleanValue": true}
  }
}
EOF

# ─────────────────────────────────────────────────────────────
# 🔗 Show and optionally run the POST request
# ─────────────────────────────────────────────────────────────
POST_URL="$FIRESTORE_ENDPOINT/$COLLECTION?documentId=$EXAMPLE_DOC_ID"

echo -e "${GREEN}📋  Example – create a doc:${NC}"
cat << CURL
curl -X POST \\
  "$POST_URL" \\
  -H "Authorization: Bearer \$FIREBASE_ID_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '$EXAMPLE_JSON'
CURL

echo ""

if [[ -n "$FIREBASE_ID_TOKEN" ]]; then
  echo -e "${BLUE}🚀  Executing …${NC}"
  response=$(curl -s -X POST \
    "$POST_URL" \
    -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$EXAMPLE_JSON")
  if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅  Document created:${NC}"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
  else
    echo -e "${RED}❌  Request failed${NC}"
    echo "$response"
  fi
else
  echo -e "${YELLOW}💡  Set FIREBASE_ID_TOKEN to actually send the request${NC}"
fi

# ─────────────────────────────────────────────────────────────
# 📚 More examples
# ─────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}📖  Further examples:${NC}"
echo ""

echo "# List last 100 docs in the collection:"
echo "curl -X GET \"$FIRESTORE_ENDPOINT/$COLLECTION?pageSize=100\" \\
  -H \"Authorization: Bearer \$FIREBASE_ID_TOKEN\""

echo "\n# Delete the created doc:"
echo "curl -X DELETE \"$FIRESTORE_ENDPOINT/$COLLECTION/$EXAMPLE_DOC_ID\" \\
  -H \"Authorization: Bearer \$FIREBASE_ID_TOKEN\""

echo "\n# Update a field (merge):"
echo "curl -X PATCH \"$FIRESTORE_ENDPOINT/$COLLECTION/$EXAMPLE_DOC_ID?updateMask.fieldPaths=title\" \\
  -H \"Authorization: Bearer \$FIREBASE_ID_TOKEN\" \\
  -H \"Content-Type: application/json\" \\
  -d '{\"fields\": {\"title\": {\"stringValue\": \"Updated via curl\"}}}'"

# End of script
