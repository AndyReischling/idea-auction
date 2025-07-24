# 🏗️ Idea Auction - Comprehensive System Documentation

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [File Structure & Organization](#file-structure--organization)
4. [Core Components](#core-components)
5. [Data Flow & State Management](#data-flow--state-management)
6. [Firestore Database Structure](#firestore-database-structure)
7. [Authentication System](#authentication-system)
8. [Bot System](#bot-system)
9. [Real-Time Features](#real-time-features)
10. [Design System](#design-system)
11. [API Endpoints](#api-endpoints)
12. [Configuration & Environment](#configuration--environment)
13. [Dependencies](#dependencies)
14. [Deployment & Maintenance](#deployment--maintenance)
15. [Troubleshooting Guide](#troubleshooting-guide)

---

## System Overview

**Idea Auction** is a real-time opinion trading platform built with Next.js 14, Firebase, and TypeScript. Users can:
- Generate and trade opinions like stocks
- Place bets on other users' portfolio performance
- Take short positions on opinions
- Interact with autonomous trading bots
- View real-time leaderboards and activity feeds

### Key Features:
- 🤖 **Autonomous Bot System**: AI traders that generate and trade opinions
- 📊 **Real-Time Portfolio Tracking**: Live updates of opinion values and P&L
- 🎯 **Advanced Betting System**: Bet on other users' portfolio performance
- 📈 **Short Positions**: Short sell opinions with risk/reward mechanics
- 🔄 **Real-Time Activity Feed**: Live updates of all trading activity
- 🏆 **Dynamic Leaderboards**: Real-time rankings with performance metrics

---

## Architecture & Technology Stack

### Frontend:
- **Next.js 14** (App Router)
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Phosphor Icons** for iconography

### Backend:
- **Firebase/Firestore** (Database)
- **Firebase Auth** (Authentication)
- **Next.js API Routes** (Server functions)

### Real-Time:
- **Firestore Real-time Listeners**
- **Custom Event System** for cross-component communication

### AI/Bot System:
- **OpenAI API** for opinion generation
- **Custom Bot Engine** for autonomous trading

---

## File Structure & Organization

```
idea-auction/
├── app/                          # Next.js 14 App Router
│   ├── api/                      # API endpoints
│   │   ├── generate/route.ts     # Opinion generation API
│   │   ├── opinion/submit.ts     # Opinion submission API
│   │   └── search/route.ts       # Search functionality API
│   ├── components/               # Reusable React components
│   │   ├── ui/                   # Design system components
│   │   ├── ActivityIntegration.tsx
│   │   ├── AuthGuard.tsx
│   │   ├── BotControlPanel.tsx
│   │   ├── GlobalActivityTracker.ts
│   │   ├── Navigation.tsx
│   │   ├── RecentActivity.tsx
│   │   └── Sidebar.tsx
│   ├── lib/                      # Core business logic
│   │   ├── auth-context.tsx      # Authentication context
│   │   ├── firebase.ts           # Firebase configuration
│   │   ├── firebase-data-service.ts
│   │   ├── realtime-data-service.ts
│   │   ├── unified-portfolio-service.ts
│   │   ├── autonomous-bots.ts    # Bot system engine
│   │   └── [various utilities]
│   ├── [page]/                   # App routes
│   │   ├── page.tsx             # Home/Market page
│   │   ├── layout.tsx           # Root layout
│   │   ├── global.css           # Global styles
│   │   ├── profile/             # User profile pages
│   │   ├── users/               # User directory & individual pages
│   │   ├── feed/                # Activity feed page
│   │   ├── generate/            # Opinion generation page
│   │   └── auth/                # Authentication pages
├── public/                       # Static assets
├── scripts/                      # Utility scripts
├── hooks/                        # Custom React hooks
└── [config files]               # Various configuration files
```

### Key Directories Explained:

#### `/app/lib/` - Core Business Logic
Contains all the core services and utilities:
- **Data Services**: Handle Firestore operations
- **Portfolio Services**: Manage user portfolios and trading
- **Bot System**: Autonomous trading engine
- **Authentication**: User management and auth flows
- **Utilities**: Helper functions and shared logic

#### `/app/components/` - React Components
- **ui/**: Design system components (buttons, cards, layouts)
- **Feature Components**: Specific functionality components
- **Integration Components**: Handle cross-component communication

#### `/app/api/` - Server-Side APIs
- **REST endpoints** for external integrations
- **Server actions** for secure operations
- **Third-party API integrations** (OpenAI, etc.)

---

## Core Components

### 1. Authentication System (`/app/lib/auth-context.tsx`)
```typescript
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

**Purpose**: Manages user authentication state and provides auth methods throughout the app.

### 2. Unified Portfolio Service (`/app/lib/unified-portfolio-service.ts`)
```typescript
class UnifiedPortfolioService {
  async loadUserPortfolio(userId: string): Promise<UserPortfolioItem[]>
  async getUserBets(userId: string): Promise<any[]>
  async getUserShorts(userId: string): Promise<any[]>
}
```

**Purpose**: Centralized service for all portfolio-related operations, ensuring data consistency.

### 3. Bot System (`/app/components/autonomous-bots.ts`)
```typescript
class AutonomousBotSystem {
  start(): void
  stop(): void
  getBots(): BotProfile[]
  isSystemRunning(): boolean
}
```

**Purpose**: Manages autonomous trading bots that generate opinions and execute trades.

### 4. Real-Time Activity Tracker (`/app/components/GlobalActivityTracker.ts`)
```typescript
class GlobalActivityTracker {
  initializeWithAuthContext(): void
  updateCurrentUser(userData: UserData): void
  processActivityChange(change: any): Promise<void>
}
```

**Purpose**: Tracks all user activity and updates portfolio statistics in real-time.

### 5. Recent Activity Component (`/app/components/RecentActivity.tsx`)
```typescript
interface RecentActivityProps {
  userId?: string;
  maxItems?: number;
  title?: string;
}
```

**Purpose**: Displays real-time activity feed with user filtering and validation.

---

## Data Flow & State Management

### 1. Authentication Flow
```
Login → Firebase Auth → AuthContext → UserProfile Creation → App State Update
```

### 2. Portfolio Updates
```
User Action → Firestore Write → Real-Time Listener → State Update → UI Refresh
```

### 3. Bot Activity
```
Bot Decision → Market Analysis → Trade Execution → Activity Logging → Portfolio Update
```

### 4. Real-Time Synchronization
```
Data Change → Firestore Trigger → Multiple Listeners → Cross-Component Events → UI Updates
```

---

## Firestore Database Structure

### Collections:

#### 1. `users`
```typescript
{
  uid: string;
  username: string;
  balance: number;
  totalEarnings: number;
  totalLosses: number;
  joinDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2. `autonomous-bots`
```typescript
{
  id: string; // Document ID
  username: string;
  personality: {
    name: string;
    traits: string[];
  };
  balance: number;
  isActive: boolean;
  lastActive: Date;
}
```

#### 3. `opinions`
```typescript
{
  id: string;
  text: string;
  author: string;
  authorId: string;
  createdAt: Date;
  source: 'user' | 'bot_generated';
}
```

#### 4. `market-data`
```typescript
{
  opinionText: string; // Document ID is derived from opinion text
  timesPurchased: number;
  timesSold: number;
  currentPrice: number;
  basePrice: number;
  priceHistory: Array<{
    price: number;
    timestamp: string;
    action: 'buy' | 'sell';
  }>;
}
```

#### 5. `user-portfolios`
```typescript
{
  userId: string; // Document ID
  items: Array<{
    opinionId: string;
    opinionText: string;
    quantity: number;
    averagePrice: number;
    lastUpdated: Date;
  }>;
  totalValue: number;
  totalCost: number;
}
```

#### 6. `activity-feed`
```typescript
{
  userId: string;
  username: string;
  type: 'buy' | 'sell' | 'bet' | 'short' | 'generate';
  opinionText?: string;
  opinionId?: string;
  amount: number;
  timestamp: Date;
  isBot: boolean;
}
```

#### 7. `transactions`
```typescript
{
  userId: string;
  type: 'buy' | 'sell' | 'earn' | 'bet_win' | 'bet_loss';
  amount: number;
  opinionText?: string;
  timestamp: Date;
  metadata: object;
}
```

#### 8. `advanced-bets`
```typescript
{
  userId: string;
  targetUser: string;
  betType: 'increase' | 'decrease';
  targetPercentage: number;
  timeframe: number; // days
  amount: number;
  potentialPayout: number;
  status: 'active' | 'won' | 'lost' | 'expired';
  placedDate: Date;
}
```

#### 9. `short-positions`
```typescript
{
  userId: string;
  opinionText: string;
  opinionId: string;
  targetDropPercentage: number;
  betAmount: number;
  potentialWinnings: number;
  status: 'active' | 'won' | 'lost' | 'expired';
  startingPrice: number;
  targetPrice: number;
}
```

### Data Relationships:
- **Users** ↔ **Portfolios** (1:1)
- **Users** ↔ **Activity** (1:many)
- **Users** ↔ **Transactions** (1:many)
- **Users** ↔ **Bets** (1:many)
- **Opinions** ↔ **Market Data** (1:1)
- **Bots** ↔ **Activity** (1:many)

---

## Authentication System

### Firebase Auth Configuration
```typescript
// app/lib/firebase.ts
const firebaseConfig = {
  apiKey: "AIzaSyA9_9vbw7jTunztB5almko8YGLvEAFMhBM",
  authDomain: "idea-auction.firebaseapp.com",
  projectId: "idea-auction",
  // ... other config
};
```

### Auth Context Implementation
```typescript
// app/lib/auth-context.tsx
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth state management
  // Profile creation and updates
  // Session management
}
```

### Protected Routes
```typescript
// app/components/AuthGuard.tsx
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) redirect('/auth');
  
  return <>{children}</>;
}
```

---

## Bot System

### Bot Engine Architecture
```typescript
// app/components/autonomous-bots.ts
class AutonomousBotSystem {
  private bots = new Map<string, BotProfile>();
  private intervals: { [botId: string]: NodeJS.Timeout } = {};
  private isRunning = false;
  
  // Bot lifecycle management
  // Decision making algorithms  
  // Trade execution
  // Activity logging
}
```

### Bot Personalities
```typescript
interface BotPersonality {
  name: string;
  traits: Array<'aggressive' | 'conservative' | 'swing_trader' | 'contrarian'>;
  riskTolerance: number;
  tradingFrequency: number;
}
```

### Bot Activities:
1. **Opinion Generation**: Creates new opinions using OpenAI
2. **Opinion Trading**: Buys/sells existing opinions
3. **Market Analysis**: Analyzes trends and prices
4. **Risk Management**: Manages portfolio exposure
5. **Betting**: Places bets on other users/bots
6. **Short Positions**: Takes contrarian positions

### Bot Data Management:
- **Real-time synchronization** with Firestore
- **Conflict resolution** for concurrent operations
- **Error recovery** and retry mechanisms
- **Performance monitoring** and analytics

---

## Real-Time Features

### 1. Firestore Real-Time Listeners
```typescript
// Real-time portfolio updates
const unsubscribe = onSnapshot(
  doc(db, 'user-portfolios', userId),
  (snapshot) => {
    if (snapshot.exists()) {
      updatePortfolioState(snapshot.data());
    }
  }
);
```

### 2. Cross-Component Communication
```typescript
// Custom events for immediate updates
window.dispatchEvent(new CustomEvent('user-activity-updated', { 
  detail: { userId: user.uid } 
}));

// Event listeners
window.addEventListener('user-activity-updated', handleActivityUpdate);
```

### 3. Activity Feed System
```typescript
// Real-time activity subscription
const activityQuery = query(
  collection(db, 'activity-feed'),
  orderBy('timestamp', 'desc'),
  limit(50)
);

const unsubscribe = onSnapshot(activityQuery, (snapshot) => {
  const activities = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  setActivityFeed(activities);
});
```

### 4. Price Updates
```typescript
// Market data real-time updates
const marketDataQuery = query(collection(db, 'market-data'));
const unsubscribe = onSnapshot(marketDataQuery, (snapshot) => {
  const updatedPrices = {};
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'modified') {
      const data = change.doc.data();
      updatedPrices[data.opinionText] = data.currentPrice;
    }
  });
  updatePricesInPortfolio(updatedPrices);
});
```

---

## Design System

### Color Scheme
```css
:root {
  --white: #ffffff;
  --black: #000000;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --green: #10b981;
  --light-green: #d1fae5;
  --red: #ef4444;
  --yellow: #f59e0b;
  --light-yellow: #fef3c7;
  --border-primary: #e5e7eb;
  --border-secondary: #d1d5db;
  --bg-light: #f9fafb;
}
```

### Typography
```css
:root {
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-md: 1.125rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2rem;
  --font-number: 'SF Mono', 'Monaco', monospace;
}
```

### Layout System
```css
.page-container {
  display: flex;
  min-height: 100vh;
  background: var(--bg-light);
}

.main-content {
  flex: 1;
  padding: 0 40px;
  margin-left: 280px; /* Sidebar width */
}

.navigation-buttons {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--white);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-lg);
}
```

### Component Patterns
- **Card-based layouts** for content organization
- **Grid systems** for responsive design
- **Consistent spacing** using design tokens
- **Interactive states** with hover/focus effects
- **Loading states** for async operations

---

## API Endpoints

### 1. Opinion Generation (`/api/generate`)
```typescript
// POST /api/generate
export async function POST() {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [/* opinion generation prompt */],
    max_tokens: 100,
    temperature: 0.9
  });
  
  return NextResponse.json({ 
    opinion: response.choices[0].message.content 
  });
}
```

### 2. Search API (`/api/search`)
```typescript
// GET /api/search?q=query&type=opinion&limit=10
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type');
  
  // Semantic search using embeddings
  const results = await embeddingService.searchSimilar(
    query,
    limit,
    type
  );
  
  return NextResponse.json({ results });
}
```

### 3. Opinion Submission (`/api/opinion/submit`)
```typescript
// POST /api/opinion/submit
export async function POST(request: NextRequest) {
  const { opinionText, source } = await request.json();
  
  // Validate and save opinion
  // Update market data
  // Log activity
  
  return NextResponse.json({ success: true });
}
```

---

## Configuration & Environment

### Environment Variables
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# OpenAI API
OPENAI_API_KEY=your_openai_key

# Next.js Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development
```

### Next.js Configuration (`next.config.ts`)
```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
```

### Firestore Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User documents
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Bot documents  
    match /autonomous-bots/{botId} {
      allow read: if true;
      allow write: if true; // Bots need write access
    }
    
    // Portfolio documents
    match /user-portfolios/{userId} {
      allow read, write: if request.auth != null;
    }
    
    // Activity feed
    match /activity-feed/{activityId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null || request.resource.data.isBot == true;
    }
  }
}
```

### Firestore Indexes (`firestore.indexes.json`)
```json
{
  "indexes": [
    {
      "collectionGroup": "activity-feed",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION", 
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Dependencies

### Core Dependencies (`package.json`)
```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "react-dom": "18.x",
    "typescript": "5.x",
    "firebase": "^10.x",
    "@phosphor-icons/react": "^2.x",
    "tailwindcss": "^3.x",
    "openai": "^4.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "eslint": "^8.x",
    "eslint-config-next": "14.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x"
  }
}
```

### Critical Dependencies Explained:

#### Firebase SDK
- **Authentication**: User management and auth flows
- **Firestore**: Real-time database operations  
- **Real-time listeners**: Live data synchronization

#### OpenAI API
- **Opinion generation**: AI-powered content creation
- **Bot personality**: Diverse trading behaviors

#### Phosphor Icons
- **Consistent iconography**: 900+ icons
- **React optimized**: Direct component imports

#### Tailwind CSS
- **Utility-first styling**: Rapid UI development
- **Design system**: Consistent spacing and colors
- **Responsive design**: Mobile-first approach

---

## Deployment & Maintenance

### Development Setup
```bash
# Clone repository
git clone [repository-url]
cd idea-auction

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase/OpenAI keys

# Start development server
npm run dev

# Open http://localhost:3000
```

### Firebase Setup
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
firebase init

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes
```

### Production Deployment
```bash
# Build production bundle
npm run build

# Start production server
npm start

# Or deploy to Vercel
npx vercel

# Or deploy to Firebase Hosting
firebase deploy --only hosting
```

### Database Maintenance
```javascript
// Regular cleanup script
const cleanupOldData = async () => {
  // Remove old activity feed entries (>30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oldActivities = query(
    collection(db, 'activity-feed'),
    where('timestamp', '<', thirtyDaysAgo)
  );
  
  const batch = writeBatch(db);
  const snapshot = await getDocs(oldActivities);
  
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`Cleaned up ${snapshot.size} old activity records`);
};

// Run monthly
setInterval(cleanupOldData, 30 * 24 * 60 * 60 * 1000);
```

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. Firebase Connection Issues
```bash
# Check Firebase configuration
console.log(firebase.apps.length); // Should be > 0

# Verify environment variables
console.log(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

# Test Firestore connection
const testDoc = await getDoc(doc(db, 'test', 'test'));
console.log('Firestore connected:', !testDoc.exists());
```

#### 2. Bot System Not Starting
```typescript
// Check bot system status
console.log('Bot system running:', botSystem.isSystemRunning());
console.log('Bot count:', botSystem.getBotCount());

// Restart bot system
botSystem.stop();
await new Promise(resolve => setTimeout(resolve, 1000));
botSystem.start();
```

#### 3. Real-Time Updates Not Working
```typescript
// Check subscription status
console.log('Active subscriptions:', realtimeDataService.getSubscriptions());

// Re-establish subscriptions
realtimeDataService.clearCache();
await realtimeDataService.reconnectAll();
```

#### 4. Data Inconsistency Issues
```typescript
// Run data consistency check
const diagnosticResults = await FirestoreDataDiagnostic.runFullDiagnostic();
console.log('Data consistency:', diagnosticResults);

// Fix common issues
await dataReconciliationService.reconcileAllUsers();
```

#### 5. Performance Issues
```typescript
// Check cache status
console.log('Cache status:', realtimeDataService.getCacheStatus());

// Monitor subscription count
console.log('Active listeners:', 
  Array.from(realtimeDataService.getSubscriptions().keys())
);

// Optimize subscriptions
realtimeDataService.optimizeSubscriptions();
```

### Development Tools

#### Browser Console Commands
```javascript
// Check authentication status
console.log('User:', window.__auth_user);

// View portfolio data
console.log('Portfolio:', window.__portfolio_data);

// Monitor real-time events
window.__debug_realtime = true;

// Test bot system
window.__bot_system.getBots();

// Run diagnostic
window.__run_diagnostic();
```

#### Database Queries for Debugging
```javascript
// Check user data consistency
const user = await getDoc(doc(db, 'users', userId));
const portfolio = await getDoc(doc(db, 'user-portfolios', userId));
const activities = await getDocs(
  query(collection(db, 'activity-feed'), where('userId', '==', userId))
);

console.log({
  user: user.exists(),
  portfolio: portfolio.exists(), 
  activities: activities.size
});
```

### Monitoring & Analytics

#### Performance Metrics
- **Page Load Times**: Monitor with Next.js built-in analytics
- **Firestore Reads/Writes**: Track via Firebase console
- **Real-time Listener Count**: Monitor subscription efficiency
- **Bot System Performance**: Track trading frequency and success

#### Error Tracking
- **Console Errors**: Monitor browser console for client errors
- **API Errors**: Track server-side errors in Next.js logs
- **Firebase Errors**: Monitor Firebase console for database issues
- **Authentication Errors**: Track auth failures and resolution

---

## Recovery & Migration

### Complete System Recovery

#### 1. Code Recovery
```bash
# If starting from scratch with this documentation
git init
npm init -y

# Install all dependencies
npm install next@14 react@18 react-dom@18 typescript
npm install firebase @phosphor-icons/react tailwindcss
npm install -D @types/node @types/react @types/react-dom

# Recreate file structure
mkdir -p app/{api,components,lib}
mkdir -p app/{profile,users,feed,generate,auth}
mkdir -p scripts hooks public
```

#### 2. Firebase Recovery
```bash
# Recreate Firebase project
# Import firestore.rules and firestore.indexes.json
# Set up authentication
# Configure security rules
```

#### 3. Data Migration
```typescript
// Export existing data
const exportFirestoreData = async () => {
  const collections = [
    'users', 'autonomous-bots', 'opinions', 
    'market-data', 'user-portfolios', 'activity-feed',
    'transactions', 'advanced-bets', 'short-positions'
  ];
  
  const backup = {};
  
  for (const collectionName of collections) {
    const snapshot = await getDocs(collection(db, collectionName));
    backup[collectionName] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
  
  return backup;
};

// Import data to new Firebase project
const importFirestoreData = async (backup) => {
  const batch = writeBatch(db);
  
  Object.entries(backup).forEach(([collectionName, documents]) => {
    documents.forEach(docData => {
      const { id, ...data } = docData;
      const docRef = doc(db, collectionName, id);
      batch.set(docRef, data);
    });
  });
  
  await batch.commit();
};
```

### System Maintenance Schedule

#### Daily:
- Monitor error logs
- Check bot system status
- Verify real-time subscriptions

#### Weekly:  
- Review performance metrics
- Check database growth
- Update bot personalities if needed

#### Monthly:
- Clean up old activity data
- Review and optimize Firestore indexes  
- Update dependencies
- Backup critical data

#### Quarterly:
- Full security audit
- Performance optimization review
- Bot system evaluation and improvements
- User feedback integration

---

## 🚀 Getting Started Checklist

When setting up the system from this documentation:

### Pre-Setup:
- [ ] Firebase project created
- [ ] OpenAI API key obtained
- [ ] Development environment ready (Node.js 18+)

### Initial Setup:
- [ ] Repository cloned/created
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured
- [ ] Firebase initialized (`firebase init`)
- [ ] Firestore rules deployed
- [ ] Firestore indexes created

### Configuration:
- [ ] Firebase configuration updated in `/app/lib/firebase.ts`
- [ ] OpenAI API key added to environment variables
- [ ] Authentication providers enabled in Firebase Console
- [ ] Firestore security rules tested

### Testing:
- [ ] Development server starts (`npm run dev`)
- [ ] Authentication flow works
- [ ] Database connections established
- [ ] Bot system initializes
- [ ] Real-time features working

### Production:
- [ ] Production build successful (`npm run build`)
- [ ] Environment variables configured for production
- [ ] Firestore rules deployed to production
- [ ] Monitoring and analytics set up

---

This documentation provides everything needed to understand, maintain, and recreate the Idea Auction system. Each section contains practical examples and code snippets that can be directly implemented.

For any specific issues or additional clarification needed, refer to the troubleshooting section or examine the actual implementation files for detailed examples. 