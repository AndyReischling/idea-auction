# Firestore Indexes Deployment Guide

## Anti-Arbitrage Feature Requirements

The new anti-arbitrage feature (4 shares max per 10 minutes) requires a composite index to efficiently query user transactions.

## Deploy New Indexes

### Option 1: Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `idea-auction`
3. Navigate to **Firestore Database** > **Indexes**
4. Click **Add Index**
5. Set up the composite index:
   - **Collection ID**: `transactions`
   - **Field 1**: `userId` (Ascending)
   - **Field 2**: `opinionText` (Ascending)
   - **Field 3**: `type` (Ascending)
   - **Field 4**: `timestamp` (Ascending)
6. Click **Create**

### Option 2: Firebase CLI
```bash
# Deploy indexes from firestore.indexes.json
firebase deploy --only firestore:indexes
```

### Option 3: Automatic Index Creation
The first time someone tries to buy a 5th share within 10 minutes, Firestore will:
1. Show an error with an index creation link
2. Click the link to auto-create the index
3. Wait 2-3 minutes for index to build
4. Feature will work automatically

## Index Details

**Query Pattern:**
```javascript
query(
  collection(db, 'transactions'),
  where('userId', '==', userId),
  where('opinionText', '==', opinionText),
  where('type', '==', 'buy'),
  where('timestamp', '>=', tenMinutesAgo),
  orderBy('timestamp', 'desc')
)
```

**Required Index:**
- Collection: `transactions`
- Fields: `userId`, `opinionText`, `type`, `timestamp`

## Verification

After deployment, test the anti-arbitrage feature:
1. Buy 4 shares of any opinion quickly
2. Try to buy a 5th share - should show restriction message
3. Wait 10 minutes and try again - should work

## Index Build Time

- **Small datasets**: 1-2 minutes
- **Large datasets**: 5-10 minutes
- **Status**: Check Firebase Console > Firestore > Indexes

## Troubleshooting

**Error: "The query requires an index"**
- The index hasn't been created yet
- Use the error link to create automatically
- Or follow Option 1 above

**Error: "Index is still building"**
- Wait for index to complete
- Check status in Firebase Console
- Usually takes 2-3 minutes

**Feature not working after index creation**
- Clear browser cache
- Refresh the page
- Check browser console for errors 