# Underscored Opinions Fix & Portfolio Structure Improvement

## Problem Description

The app was showing duplicate opinions with underscores (e.g., `I_don_t_think_much_of_corn`) in user profiles. This was caused by a fundamental issue in how portfolio data was stored in Firebase.

### Root Cause

The problem occurred because:

1. **Firebase Field Name Limitations**: Firebase field names cannot contain periods (`.`), spaces, or special characters like `#`, `$`, `[]`
2. **Poor Data Structure**: The app was using opinion text as field names in portfolio objects
3. **Sanitization Function**: A `sanitizeFieldName` function was converting opinion text to valid field names:
   ```javascript
   const sanitizeFieldName = (text: string): string => {
     return text.replace(/[.#$[\]]/g, '_').replace(/\s+/g, '_').slice(0, 100);
   };
   ```
4. **Storage Pattern**: Portfolios were stored as:
   ```javascript
   portfolio: {
     "I_don_t_think_much_of_corn": 4,
     "Wim_Wenders_is_a_good_pictures_director": 2
   }
   ```

### Issues This Caused

- **Duplicate Entries**: Same opinion appearing multiple times with different sanitized keys
- **Data Corruption**: Loss of original opinion text
- **Complex Recovery**: Required reverse lookups to find original opinion text
- **Poor User Experience**: Confusing underscored opinion names in UI

## Solution

### 1. New Portfolio Data Structure

Created a better portfolio structure in `app/lib/portfolio-utils.ts`:

```typescript
interface PortfolioItem {
  opinionId: string;
  opinionText: string;
  quantity: number;
  totalCost: number;
  averagePrice: number;
  lastUpdated: string;
  transactions: string[];
}

interface Portfolio {
  items: PortfolioItem[];
  totalValue: number;
  totalCost: number;
  lastUpdated: string;
}
```

### 2. Migration Strategy

- **New Field**: Store portfolio data in `portfolioV2` field
- **Automatic Migration**: Migrate old data when detected
- **Backward Compatibility**: Keep old data until migration is complete

### 3. Key Improvements

#### A. No More Sanitization
- Use proper data structure instead of opinion text as field names
- Store original opinion text directly in `opinionText` field

#### B. Better Data Organization
- Arrays of objects instead of field name mapping
- Proper typing with TypeScript interfaces
- Transaction history tracking

#### C. Deduplication
- Automatic consolidation of duplicate entries
- Quantity aggregation for same opinions

## Implementation

### 1. Portfolio Utilities (`app/lib/portfolio-utils.ts`)

- `getUserPortfolio(userId)`: Get user's portfolio in new format
- `updateUserPortfolio(...)`: Update portfolio with new transaction
- `migrateUserPortfolio(userId)`: Migrate old portfolio to new format
- `getUsersNeedingMigration()`: Find users that need migration

### 2. Migration Script (`scripts/clean-portfolio-data.js`)

- Automated cleanup of existing portfolio data
- Deduplication of underscored entries
- Consolidation of quantities for same opinions

### 3. Updated Profile Page (`app/profile/opinions/page.tsx`)

- Uses new portfolio structure
- Automatic migration when old data is detected
- Clean display without underscored duplicates

## Usage

### Running the Migration

```bash
# Clean up existing portfolio data
node scripts/clean-portfolio-data.js

# Or run individual user migration
import { migrateUserPortfolio } from './app/lib/portfolio-utils';
await migrateUserPortfolio(userId);
```

### Using New Portfolio Functions

```typescript
import { getUserPortfolio, updateUserPortfolio } from './app/lib/portfolio-utils';

// Get user's portfolio
const portfolio = await getUserPortfolio(userId);

// Update portfolio with new transaction
await updateUserPortfolio(
  userId,
  opinionId,
  opinionText,
  quantityChange,
  pricePerShare,
  transactionId
);
```

## Benefits

1. **Clean Data**: No more underscored opinion names
2. **Proper Structure**: Normalized data structure
3. **Better Performance**: Faster lookups and operations
4. **Maintainable**: Easier to extend and modify
5. **Type Safety**: Full TypeScript support

## Migration Status

- ✅ Portfolio utilities created
- ✅ Migration script created
- ✅ Profile page updated
- ✅ Syntax errors fixed
- ⏳ Opinion page needs updating to use new structure
- ⏳ Other pages need updating (users, leaderboard, etc.)

## Next Steps

1. Update `app/opinion/[id]/page.tsx` to use new portfolio functions
2. Update leaderboard calculations
3. Run migration script on production data
4. Monitor for any remaining issues
5. Remove old portfolio field after migration is complete

## Testing

Test the migration by:
1. Creating a user with portfolio data
2. Running the migration
3. Verifying opinions display correctly
4. Checking for duplicate entries

## Files Modified

- `app/lib/portfolio-utils.ts` - New portfolio utilities
- `app/profile/opinions/page.tsx` - Updated to use new structure
- `scripts/clean-portfolio-data.js` - Migration script
- `UNDERSCORED_OPINIONS_FIX.md` - This documentation

## Rollback Plan

If issues arise:
1. Revert to using old `portfolio` field
2. The old data is preserved during migration
3. Remove `portfolioV2` field if needed
4. Restart migration process after fixes 