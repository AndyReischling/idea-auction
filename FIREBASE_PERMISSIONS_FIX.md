# 🔒 Firebase Permissions Fix Guide

## Problem  
You’re seeing errors such as  
- **“FirebaseError: Missing or insufficient permissions”**  
- **“⚠️ Failed to add bot transaction to Firebase”**

They appear when Firestore security rules block user or bot writes to the **`activity-feed`** collection.

---

## Quick Fix (≈ 5 minutes)

### 1 — Open Firebase Console
1. Go to <https://console.firebase.google.com>  
2. Select your project **“idea-auction”**

### 2 — Replace Security Rules
1. In the sidebar choose **Firestore Database** ▸ **Rules**  
2. **Overwrite everything** with the contents of your local `firestore.rules` file  
3. Click **Publish** and wait ~30 seconds

### 3 — Verify
1. Refresh the feed page in your app  
2. The banner should show **“✅ Firebase Connected”**  
3. New activity (including bot posts) should appear instantly without errors

---

## What the New Rules Allow

| ✅ Allowed                                            | 🔒 Blocked                                   |
|------------------------------------------------------|---------------------------------------------|
| Public **read** access to the live `activity-feed`   | Writes missing required validation fields   |
| Authenticated **user writes**                        | Users reading data that isn’t theirs        |
| **Bot writes** when `isBot: true`                    | Anonymous writes                            |
| **System writes** when `metadata.source == 'bot_system'` | Access to any other restricted collection |

All other collections remain locked behind user authentication.

---

## Dev vs Production Rules

### Development / Staging

```javascript
match /activity-feed/{id} {
  // anyone can watch the feed
  allow read:  if true;

  // users & bots can write
  allow write: if request.auth != null;
  allow write: if request.resource.data.isBot == true;
  allow write: if request.resource.data.metadata.source == 'bot_system';
}
