#!/bin/bash

# One-liner to extract localStorage and push to Firestore
# Usage: ./scripts/one-liner.sh

echo "🚀 LocalStorage → Firestore One-Liner"
echo ""
echo "This script combines extraction and upload in one command."
echo ""

# Check if we have the required tools
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed."
    exit 1
fi

echo "📋 Step 1: Extract localStorage data"
echo "Run this in your browser console:"
echo ""
echo "localStorage.getItem('ls-backup') || (() => {"
echo "  const data = Object.keys(localStorage).map(key => ({"
echo "    key, value: localStorage[key],"
echo "    isJSON: (() => { try { JSON.parse(localStorage[key]); return true; } catch { return false; } })()"
echo "  }));"
echo "  localStorage.setItem('ls-backup', JSON.stringify(data));"
echo "  return 'Data saved to ls-backup key';"
echo "})();"
echo ""

echo "📤 Step 2: Upload to Firestore"
echo "After running the above, visit: http://localhost:3000/local-storage-export"
echo ""

echo "🔄 Alternative: Direct file upload"
echo "1. Save your localStorage as JSON file"
echo "2. Run: npm run push-to-firestore push-json ./your-file.json"
echo ""

echo "📖 For more options, see: scripts/README.md" 