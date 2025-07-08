#!/bin/bash

# Example script showing how to push localStorage data to Firestore using curl
# This demonstrates the equivalent of what the Node.js script does

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Firestore cURL Example${NC}"
echo "This script demonstrates how to push localStorage data to Firestore using curl."
echo ""

# Check if required variables are set
if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
    echo -e "${RED}❌ Error: FIREBASE_PROJECT_ID environment variable is required${NC}"
    echo "Set it with: export FIREBASE_PROJECT_ID=your-project-id"
    exit 1
fi

if [[ -z "$FIREBASE_ID_TOKEN" ]]; then
    echo -e "${YELLOW}⚠️  Warning: FIREBASE_ID_TOKEN not set${NC}"
    echo "To authenticate, you need to get an ID token from Firebase Auth."
    echo "You can get this from your browser's localStorage or by signing in programmatically."
    echo ""
    echo -e "${BLUE}Example to get ID token:${NC}"
    echo "1. Open your browser console on your app"
    echo "2. Run: firebase.auth().currentUser.getIdToken().then(token => console.log(token))"
    echo "3. Copy the token and run: export FIREBASE_ID_TOKEN=your-token-here"
    echo ""
fi

# Example localStorage data
EXAMPLE_DATA='{
  "fields": {
    "userId": {"stringValue": "user123"},
    "key": {"stringValue": "exampleKey"},
    "value": {"stringValue": "exampleValue"},
    "isJSON": {"booleanValue": false},
    "uploadedAt": {"timestampValue": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"},
    "uploadMethod": {"stringValue": "curl"}
  }
}'

echo -e "${GREEN}📋 Example cURL command:${NC}"
echo ""

# Show the curl command
cat << EOF
curl -X POST \\
  "https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT_ID/databases/(default)/documents/localStorage_backup" \\
  -H "Authorization: Bearer \$FIREBASE_ID_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '$EXAMPLE_DATA'
EOF

echo ""
echo ""

# If we have the token, actually run the command
if [[ -n "$FIREBASE_ID_TOKEN" ]]; then
    echo -e "${BLUE}🚀 Running the command...${NC}"
    echo ""
    
    response=$(curl -s -X POST \
      "https://firestore.googleapis.com/v1/projects/$FIREBASE_PROJECT_ID/databases/(default)/documents/localStorage_backup" \
      -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$EXAMPLE_DATA")
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Success! Response:${NC}"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo -e "${RED}❌ Request failed${NC}"
        echo "$response"
    fi
else
    echo -e "${YELLOW}💡 To run this command, set FIREBASE_ID_TOKEN first${NC}"
fi

echo ""
echo -e "${BLUE}📖 More examples:${NC}"
echo ""
echo "# Push a single localStorage item:"
echo "curl -X POST \\"
echo "  \"https://firestore.googleapis.com/v1/projects/\$FIREBASE_PROJECT_ID/databases/(default)/documents/localStorage_backup\" \\"
echo "  -H \"Authorization: Bearer \$FIREBASE_ID_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"fields\": {\"key\": {\"stringValue\": \"myKey\"}, \"value\": {\"stringValue\": \"myValue\"}}}'"
echo ""
echo "# List all documents in the collection:"
echo "curl -X GET \\"
echo "  \"https://firestore.googleapis.com/v1/projects/\$FIREBASE_PROJECT_ID/databases/(default)/documents/localStorage_backup\" \\"
echo "  -H \"Authorization: Bearer \$FIREBASE_ID_TOKEN\""
echo ""
echo "# Delete a document:"
echo "curl -X DELETE \\"
echo "  \"https://firestore.googleapis.com/v1/projects/\$FIREBASE_PROJECT_ID/databases/(default)/documents/localStorage_backup/DOCUMENT_ID\" \\"
echo "  -H \"Authorization: Bearer \$FIREBASE_ID_TOKEN\""
echo ""
echo -e "${GREEN}🎯 For batch operations, use the Node.js script instead:${NC}"
echo "npm run push-to-firestore push-json ./localStorage-data.json" 