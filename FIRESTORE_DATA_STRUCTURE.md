# 🔍 Firestore Data Structure & Consistency Analysis

## Overview
This document outlines the Firestore collections, their relationships, and consistency requirements for the username pages.

## 📊 Collection Structure

### 1. `users` Collection
```
Document ID: {user_uid}
Fields:
  - uid: string
  - username: string  
  - balance: number
  - totalEarnings: number
  - totalLosses: number
  - joinDate: Date
  - createdAt: Date
  - updatedAt: Date
```

### 2. `autonomous-bots` Collection
```
Document ID: {bot_id}
Fields:
  - username: string (optional)
  - personality.name: string (primary username)
  - balance: number
  - totalEarnings: number
  - totalLosses: number
  - joinDate: Date
  - isActive: boolean
  - lastActive: Date
```

### 3. `activity-feed` Collection
```
Document ID: {activity_id}
Fields:
  - userId: string (CRITICAL: Must match user's uid)
  - username: string 
  - type: 'buy' | 'sell' | 'bet' | 'generate' | etc.
  - opinionText: string
  - opinionId: string
  - amount: number
  - timestamp: Date
  - isBot: boolean
  - botId: string (optional)
```

### 4. `transactions` Collection  
```
Document ID: {transaction_id}
Fields:
  - userId: string (CRITICAL: Must match user's uid)
  - username: string
  - type: 'buy' | 'sell' | 'earn' | etc.
  - amount: number
  - opinionText: string
  - opinionId: string
  - timestamp: Date
  - metadata: object
```

### 5. `user-portfolios` Collection
```
Document ID: {user_uid} 
Fields:
  - items: array of {
      opinionId: string,
      opinionText: string,
      quantity: number,
      averagePrice: number,
      lastUpdated: Date
    }
  - totalValue: number
  - totalCost: number
  - lastUpdated: Date
```

## 🔗 Data Relationships

### Username Resolution Flow:
1. **URL**: `/users/[username]` → Extract username
2. **Query 1**: `users.where('username', '==', username)`
3. **Query 2**: `autonomous-bots.get()` → Filter by `personality.name == username`
4. **Result**: Resolve to `userId` (either `user.uid` or `bot.id`)

### Data Attribution Requirements:
- **All activity must use consistent `userId`**
- **All transactions must use consistent `userId`**
- **All portfolio data must use consistent `userId`**

## ❌ Common Consistency Issues

### Issue 1: Username/UserId Mismatch
```
Problem: Activity shows username "HotFalcon_878" but userId points to different user
Root Cause: Bot system writes activities with bot username but wrong userId
Fix: Ensure bot activities use bot's document ID as userId
```

### Issue 2: Cross-Collection Inconsistency  
```
Problem: User has transactions but no portfolio document
Root Cause: Portfolio creation/update failed or used wrong userId
Fix: Implement data reconciliation and validation
```

### Issue 3: Activity Attribution Errors
```
Problem: Activities from User A appear on User B's profile
Root Cause: RecentActivity component doesn't validate userId matching
Fix: Add strict userId validation in activity queries
```

## 🛠️ API Testing Commands

### Test Username Resolution
```bash
# Check if user exists in users collection
curl -s "http://localhost:3000/api/search?q=Swing-Trader Sam&type=user&limit=5"

# Check bot system
curl -s "http://localhost:3000/api/search?q=HotFalcon_878&type=user&limit=5"
```

### Test Activity Attribution
```bash
# Generate test activity
curl -s -X POST http://localhost:3000/api/generate

# Search for activities  
curl -s "http://localhost:3000/api/search?q=activity&type=activity&limit=10"
```

## 🔍 Diagnostic Queries (Browser Console)

### Check Username Resolution
```javascript
// In browser console on username page:
// Check what user was resolved
console.log('Resolved User ID:', profile?.uid);
console.log('Expected Username:', username);
```

### Validate Activity Attribution
```javascript
// Check if activities match expected user
recentActivity.forEach(activity => {
  if (activity.userId !== profile?.uid) {
    console.error('Mismatched activity:', activity);
  }
});
```

## ✅ Data Consistency Checklist

- [ ] Username resolution returns correct userId
- [ ] All activities have matching userId field
- [ ] All transactions have matching userId field  
- [ ] Portfolio document exists for userId
- [ ] Activity usernames match expected display names
- [ ] Bot activities use bot document ID as userId
- [ ] No cross-user data leakage in queries

## 🚨 Critical Fixes Implemented

1. **userId Validation**: RecentActivity component now validates userId matches
2. **Data Filtering**: Activities with mismatched userIds are filtered out
3. **Real-time Subscriptions**: Replaced intervals with real-time Firestore listeners
4. **Comprehensive Logging**: Added detailed debug logs for data flow tracking
5. **Diagnostic Tool**: Added browser-based Firestore diagnostic component

## 📋 Monitoring & Maintenance

### Check for Data Inconsistencies
```javascript
// Run this in browser console regularly
FirestoreDataDiagnostic.runDiagnostic('Swing-Trader Sam');
```

### Validate Bot Data Attribution
```javascript
// Check bot activity attribution
autonomousBots.forEach(bot => {
  console.log(`Bot ${bot.id}: username=${bot.personality?.name}`);
});
```

## 🔄 Data Reconciliation Script (Future)
Consider implementing automated data reconciliation to:
- Fix mismatched userId fields
- Synchronize usernames across collections  
- Validate portfolio consistency
- Clean up orphaned data 