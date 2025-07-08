# localStorage to Firestore Migration Tools

This directory contains tools to help you migrate your browser's localStorage data to Firestore Cloud Database.

## 🚀 Quick Start

### Option 1: Browser-based Upload (Easiest)

1. **Visit the web interface**: Go to `/local-storage-export` in your app
2. **Sign in** to your account
3. **Select the localStorage items** you want to upload
4. **Click "Upload"** - done!

### Option 2: Command Line Script

1. **Extract localStorage data** from your browser
2. **Upload using Node.js script**

## 📋 Step-by-Step Instructions

### Method 1: Browser Interface

1. Navigate to `http://localhost:3000/local-storage-export`
2. Sign in with your account
3. Review all localStorage items
4. Select what you want to upload
5. Click "Upload to Firestore"

### Method 2: Command Line

#### Step 1: Extract localStorage Data

**Option A: Use the browser console**
```bash
npm run extract-localStorage
```
This will show you a script to run in your browser console that downloads localStorage as JSON.

**Option B: Manual extraction**
Open your browser console and run:
```javascript
// Extract localStorage data
const localStorageData = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key) {
    const value = localStorage.getItem(key);
    if (value) {
      localStorageData.push({
        key,
        value,
        parsedValue: (() => {
          try { return JSON.parse(value); } catch { return value; }
        })(),
        isJSON: (() => {
          try { JSON.parse(value); return true; } catch { return false; }
        })()
      });
    }
  }
}

// Download as JSON file
const dataStr = JSON.stringify(localStorageData, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'localStorage-data.json';
link.click();
```

#### Step 2: Setup Firebase Admin SDK

1. **Get Firebase Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `firebase-service-account.json` in your project root

2. **Set environment variables** (optional):
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```

#### Step 3: Upload to Firestore

```bash
# Upload JSON file to Firestore
npm run push-to-firestore push-json ./localStorage-data.json

# List Firestore collections
npm run list-firestore
```

### Method 3: Direct cURL Commands

For advanced users who want to use curl directly:

1. **Get your Firebase ID Token**:
   ```javascript
   // Run in browser console when signed in
   firebase.auth().currentUser.getIdToken().then(token => console.log(token))
   ```

2. **Set environment variables**:
   ```bash
   export FIREBASE_PROJECT_ID=your-project-id
   export FIREBASE_ID_TOKEN=your-id-token-here
   ```

3. **Run the curl example**:
   ```bash
   chmod +x scripts/curl-example.sh
   ./scripts/curl-example.sh
   ```

## 📁 File Structure

```
scripts/
├── README.md              # This file
├── push-to-firestore.js   # Node.js script for batch uploads
└── curl-example.sh        # cURL examples and demo

app/
└── local-storage-export/
    └── page.tsx           # Browser-based upload interface
```

## 🔧 Available Commands

```bash
# Extract localStorage (shows browser script)
npm run extract-localStorage

# Upload JSON file to Firestore
npm run push-to-firestore push-json ./localStorage-data.json

# List Firestore collections
npm run list-firestore

# Show curl examples
./scripts/curl-example.sh
```

## 📊 Data Structure

Your localStorage data will be stored in Firestore with this structure:

```json
{
  "userId": "user123",
  "userEmail": "user@example.com",
  "key": "originalLocalStorageKey",
  "value": "originalStringValue",
  "parsedValue": {}, // Parsed JSON if applicable
  "isJSON": true,
  "exportedAt": "2024-01-01T00:00:00.000Z",
  "uploadMethod": "script" // or "web"
}
```

## 🔒 Security Notes

- **Service Account Key**: Keep your Firebase service account key secure and never commit it to version control
- **ID Tokens**: ID tokens expire after 1 hour, so you may need to refresh them
- **Data Privacy**: Only upload localStorage data that you own and are authorized to migrate

## 🐛 Troubleshooting

### "Firebase service account file not found"
- Download the service account key from Firebase Console
- Save it as `firebase-service-account.json` in your project root

### "Authentication failed"
- Make sure your Firebase ID token is valid and not expired
- Re-run the browser console command to get a fresh token

### "Permission denied"
- Ensure your Firestore security rules allow authenticated users to write to the `localStorage_backup` collection
- Check that you're signed in with the correct account

### "Network errors"
- Check your internet connection
- Verify your Firebase project ID is correct
- Ensure Firestore is enabled in your Firebase project

## 🎯 Best Practices

1. **Test first**: Try uploading a small amount of data first
2. **Backup**: Keep a local copy of your localStorage data
3. **Clean up**: Remove sensitive data before uploading
4. **Monitor**: Check Firestore console to verify uploads succeeded
5. **Security**: Use the browser interface for sensitive data (it uses your authenticated session)

## 📝 Examples

### Upload specific localStorage items
```bash
# Create a filtered JSON file with only the items you want
cat localStorage-data.json | jq '[.[] | select(.key | startswith("myapp_"))]' > filtered-data.json
npm run push-to-firestore push-json ./filtered-data.json
```

### Bulk delete uploaded data
```bash
# List collections first
npm run list-firestore

# Use Firebase Console or write a custom script to delete documents
```

## 🔗 Related Tools

- **Firebase Console**: Monitor your uploaded data
- **Firestore Web Interface**: View and manage documents
- **Firebase CLI**: Additional command-line tools for Firebase

For more advanced usage, check the source code in the scripts directory! 