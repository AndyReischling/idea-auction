# localStorage to Firebase Sync

A comprehensive solution to sync all your localStorage data to Firebase Firestore with proper organization and error handling.

## 🚀 Quick Start

### Option 1: Web Interface (Recommended)
1. Visit `/localStorage-sync` in your app
2. Sign in to your account
3. Click "Sync All Data to Firebase"
4. Watch the real-time progress and results

### Option 2: Browser Console (Quick & Easy)
```javascript
// In browser console, just run:
quickSyncNow()
```

### Option 3: Programmatic Use
```javascript
import { syncLocalStorageToFirebase } from './lib/quick-sync';

// Sync all data
const result = await syncLocalStorageToFirebase({
  onProgress: (progress) => {
    console.log(`${progress.completed}/${progress.total} - ${progress.current}`);
  }
});

// Sync specific keys
import { syncSpecificData } from './lib/quick-sync';
await syncSpecificData(['userProfile', 'transactions']);
```

## 📦 What Gets Synced

The system automatically organizes your localStorage data into appropriate Firebase collections:

| localStorage Key | Firebase Collection | Description |
|------------------|-------------------|-------------|
| `userProfile` | `users` | User profile data |
| `opinions` | `opinions` | User opinions |
| `transactions` | `transactions` | Transaction history |
| `globalActivityFeed` | `activity-feed` | Activity feed data |
| `opinionMarketData` | `market-data` | Market data |
| `portfolioData` | `user-portfolios` | Portfolio information |
| `autonomousBots` | `bots` | Bot data |
| `advancedBets` | `advanced-bets` | Betting data |
| `shortPositions` | `short-positions` | Short position data |
| `embeddings` | `embeddings` | Search embeddings |
| Other keys | `localStorage_backup` | General backup collection |

## 🔧 Features

### Smart Data Organization
- Automatically identifies data types from localStorage keys
- Maps data to appropriate Firebase collections
- Preserves data structure and relationships

### Progress Tracking
- Real-time progress updates
- Detailed success/failure reporting
- Individual item processing status

### Error Handling
- Graceful failure handling
- Detailed error messages
- Partial sync support (continues on errors)

### Authentication
- Requires user authentication
- User-specific data organization
- Secure data access

### Backup Creation
- Creates complete backup in `localStorage_backup` collection
- Includes metadata and timestamps
- Preserves original data structure

## 📊 Usage Examples

### Basic Sync
```javascript
import { syncLocalStorageToFirebase } from './lib/quick-sync';

// Simple sync
const result = await syncLocalStorageToFirebase();
console.log(`Synced ${result.summary.totalItems} items to ${result.summary.collections} collections`);
```

### With Progress Tracking
```javascript
const result = await syncLocalStorageToFirebase({
  onProgress: (progress) => {
    const percentage = (progress.completed / progress.total) * 100;
    console.log(`Progress: ${percentage.toFixed(1)}% - ${progress.current}`);
  },
  onComplete: (results) => {
    console.log('Sync completed!', results);
  }
});
```

### Specific Data Types
```javascript
import { syncSpecificData } from './lib/quick-sync';

// Sync only user profile and transactions
await syncSpecificData(['userProfile', 'transactions']);
```

### Get Stats Only
```javascript
import { getLocalStorageStats } from './lib/quick-sync';

const stats = getLocalStorageStats();
console.log(`Found ${stats.totalItems} items, ${stats.totalSize} bytes`);
```

## 🛠️ Technical Details

### Data Structure
Each synced item includes:
- Original localStorage key and value
- Parsed JSON data (if applicable)
- User ID association
- Sync timestamp
- Size information
- Source metadata

### Firebase Security
- User-specific data access
- Proper authentication checks
- Secure write operations
- Collection-level permissions

### Performance
- Batch operations for efficiency
- Progress tracking
- Error isolation
- Memory-efficient processing

## 🔍 Troubleshooting

### Common Issues

**"User must be authenticated"**
- Make sure you're logged in before syncing
- Check your authentication status

**"Permission denied"**
- Ensure Firestore rules allow authenticated users to write
- Check your Firebase project configuration

**"Some items failed to sync"**
- Check the detailed results for specific error messages
- Large items may fail due to Firestore size limits
- Some data types may need manual review

### Debug Mode
Add this to your browser console to see detailed logs:
```javascript
localStorage.setItem('debug', 'true');
```

## 🚨 Important Notes

1. **Authentication Required**: You must be logged in to sync data
2. **Data Backup**: All data is also backed up to `localStorage_backup` collection
3. **Firestore Limits**: Individual documents must be under 1MB
4. **Incremental Sync**: Running sync multiple times is safe (creates new documents)
5. **Data Privacy**: Only authenticated users can access their own data

## 🎯 Quick Commands

```javascript
// Browser console commands (available globally)
quickSyncNow()                    // Sync everything now
getLocalStorageStats()            // Check what's in localStorage
syncLocalStorageToFirebase()      // Programmatic sync
```

## 📱 Web Interface

Visit `/localStorage-sync` for a full web interface with:
- Real-time progress bars
- Detailed success/failure stats
- Individual data type sync buttons
- Visual feedback and error reporting

## 🔗 Related Files

- `app/lib/localStorage-to-firebase.ts` - Main sync service
- `app/lib/quick-sync.ts` - Simple helper functions
- `app/components/LocalStorageSync.tsx` - React component
- `app/localStorage-sync/page.tsx` - Web interface page

---

**Ready to sync? Just run `quickSyncNow()` in your browser console! 🚀** 