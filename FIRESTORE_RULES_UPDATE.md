# Firebase Rules Update Guide

## Changes Made

The Firestore rules have been updated to allow public access to the `public-leaderboard` collection. The new rule was added:

```javascript
/* ───────────── PUBLIC LEADERBOARD ───────────── */
match /public-leaderboard/{document=**} {
  allow read: if true;  // Public read access for top 5 traders
  allow write: if request.auth != null; // Only authenticated users can update
}
```

## Manual Deployment Options

### Option 1: Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Rules**
4. Copy the content from `firestore.rules` file
5. Paste it into the rules editor
6. Click **Publish**

### Option 2: CLI Deployment
If you have Firebase CLI configured:
```bash
# Initialize Firebase project (if not done)
firebase init

# Deploy rules
firebase deploy --only firestore:rules
```

### Option 3: Set up Firebase CLI
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
firebase init

# Deploy rules
firebase deploy --only firestore:rules
```

## Verification

After deploying the rules, you can verify they work by:
1. Opening the app in an incognito/private browsing window (to ensure you're not authenticated)
2. Checking that the "Top Traders" section loads without errors
3. Looking at the browser console - there should be no permission errors

## Populating the Public Leaderboard

After rules are deployed, populate the public leaderboard by:

1. **Automatic**: When authenticated users visit `/users`, it will automatically populate the public leaderboard
2. **Manual**: Run the script (requires Firebase config):
   ```bash
   node scripts/populate-public-leaderboard.js
   ```

## Expected Behavior

- **Unauthenticated users**: Will see the top 5 traders with limited information (username, portfolio value, top holdings)
- **Authenticated users**: Will see the full leaderboard with detailed information
- **Dynamic updates**: The public leaderboard updates automatically when the main leaderboard is calculated 