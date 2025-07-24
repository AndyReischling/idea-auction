# How to Add Consistent UI Elements to Your Pages

This guide shows you **exactly** how to migrate your existing pages to use the new design system for consistent headers and UI elements across your application.

## 🎯 Quick Start: 3 Steps to Consistent Pages

### 1. Replace Your Current Layout

**BEFORE (using CSS classes):**
```typescript
// Old approach in your pages
import styles from './page.module.css';

function MyPage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerSection}>
        {/* Manual header code */}
      </div>
      <div className={styles.mainContent}>
        {/* Page content */}
      </div>
    </div>
  );
}
```

**AFTER (using design system):**
```typescript
// New approach - clean and consistent
import { Layout, PageContainer, Section } from '@/components/ui';

function MyPage() {
  return (
    <Layout>
      <PageContainer
        title="My Page Title"
        subtitle="Optional subtitle"
      >
        {/* Page content */}
      </PageContainer>
    </Layout>
  );
}
```

### 2. Replace Manual Headers

**BEFORE:**
```typescript
// Manual header with CSS
<div className="header-section">
  <div className="user-header">...</div>
  <div className="navigation-buttons">...</div>
</div>
```

**AFTER:**
```typescript
// Consistent header with options
<Layout
  header={{
    currentPage: 'feed',       // Auto-hides this nav item
    showSearch: true,          // Show search bar
    title: "Custom Title"      // Optional custom title
  }}
>
```

### 3. Use Consistent Components

**BEFORE:**
```typescript
// Manual styling
<div className="card">
  <div className="card-header">
    <h3>Title</h3>
  </div>
</div>
```

**AFTER:**
```typescript
// Design system components
import { Card, CardHeader, CardTitle, Button, Icon, Badge } from '@/components/ui';

<Card interactive>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <Badge variant="success">New</Badge>
  </CardHeader>
  <CardContent>
    <Button variant="primary" iconBefore="buy">Buy</Button>
  </CardContent>
</Card>
```

### 4. Use OpinionCard for All Opinion Displays

**BEFORE:**
```typescript
// Manual opinion card with inline styles
<a href={`/opinion/${o.id}`} style={{...lots of inline styles...}}>
  <div style={{...}}>
    <p>{o.text}</p>
    <div>
      <span>Qty: {o.quantity}</span>
      <span>Avg: ${o.averagePrice.toFixed(2)}</span>
    </div>
  </div>
  <div style={{...}}>
    <p>${o.currentPrice.toFixed(2)}</p>
    <p>{o.unrealizedGainLoss >= 0 ? '+' : ''}${o.unrealizedGainLoss.toFixed(2)}</p>
  </div>
</a>
```

**AFTER:**
```typescript
// Consistent OpinionCard component
import { OpinionCard, OpinionDataDebugger } from '@/components/ui';

// Debug data issues in development
<OpinionDataDebugger opinions={ownedOpinions} />

// Render consistent cards
{opinions.map((opinion) => (
  <OpinionCard
    key={opinion.id}
    opinion={opinion}
    variant="default"    // or "compact" for lists
  />
))}
```

**OpinionCard Features:**
- ✅ **Handles missing data gracefully** (shows warnings for undefined IDs/text)
- ✅ **Multiple variants** (`default`, `compact`) 
- ✅ **Consistent styling** using design system
- ✅ **Type-safe props** with OpinionCardData interface
- ✅ **Built-in hover effects** and responsive design

---

## 📄 Real Examples: Updating Your Pages

### Example 1: Update a Profile Page

**BEFORE (existing structure):**
```typescript
// Current profile page approach
'use client';
import styles from './page.module.css';

export default function ProfilePage() {
  return (
    <div className="page-container">
      {/* Manual header */}
      <div className="header-section">
        <div className="user-header">...</div>
        <Navigation currentPage="profile" />
      </div>
      
      {/* Manual content */}
      <div className="main-content">
        <div className={styles.walletOverview}>
          <div className={styles.walletCard}>
            <h3>Balance</h3>
            <p>$1,234.56</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**AFTER (design system approach):**
```typescript
// New consistent approach
'use client';
import { 
  Layout, 
  PageContainer, 
  Section, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  Grid,
  Badge 
} from '@/components/ui';

export default function ProfilePage() {
  return (
    <Layout header={{ currentPage: 'profile' }}>
      <PageContainer
        title="Your Portfolio"
        subtitle="Track your investments and performance"
      >
        <Section title="Wallet Overview">
          <Grid columns="auto-fit-4" gap="lg">
            <Card>
              <CardHeader>
                <CardTitle>Balance</CardTitle>
                <Badge variant="success">Active</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-number">$1,234.56</div>
              </CardContent>
            </Card>
            {/* More cards... */}
          </Grid>
        </Section>
      </PageContainer>
    </Layout>
  );
}
```

### Example 2: Update an Opinion Page

**BEFORE:**
```typescript
// Manual opinion page
export default function OpinionPage() {
  return (
    <div className="page-container">
      {/* Lots of manual CSS and styling */}
      <div className="card">
        <div className="opinionPricing">
          <p>Current Price</p>
          <div className="currentPricing">
            <p>$12.45</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**AFTER:**
```typescript
// Clean design system approach
import { 
  Layout, 
  PageContainer, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter,
  Button, 
  Icon, 
  Badge 
} from '@/components/ui';

export default function OpinionPage() {
  return (
    <Layout header={{ currentPage: 'opinion', showSearch: true }}>
      <PageContainer>
        <Card interactive>
          <CardHeader>
            <div className="flex-1">
              <CardTitle>AI will revolutionize healthcare</CardTitle>
              <Badge variant="trending" icon="trending">Trending</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold font-number">$12.45</div>
              <div className="flex items-center gap-2">
                <Icon name="trendUp" className="text-emerald-green" />
                <span className="text-emerald-green font-bold">+5.2%</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex gap-3">
              <Button variant="primary" iconBefore="buy">Buy</Button>
              <Button variant="danger" iconBefore="sell">Sell</Button>
            </div>
          </CardFooter>
        </Card>
      </PageContainer>
    </Layout>
  );
}
```

---

## 🔄 Migration Checklist

### Step-by-Step Migration Process

1. **✅ Import the design system components:**
   ```typescript
   import { 
     Layout, 
     PageContainer, 
     Section, 
     Card, 
     Button, 
     Icon, 
     Badge, 
     Grid 
   } from '@/components/ui';
   ```

2. **✅ Replace page wrapper with Layout:**
   ```typescript
   // Remove manual page container
   <div className="page-container">
   
   // Add Layout component
   <Layout header={{ currentPage: 'yourpage' }}>
   ```

3. **✅ Replace manual headers:**
   ```typescript
   // Remove manual header sections
   <div className="header-section">...</div>
   
   // Configure header in Layout props
   header={{
     currentPage: 'feed',      // Auto-hides this nav item
     showSearch: true,         // Shows search bar
     title: "Custom Title"     // Custom title override
   }}
   ```

4. **✅ Replace CSS-based cards:**
   ```typescript
   // Replace manual card divs
   <div className="card">
     <div className="card-header">...</div>
   </div>
   
   // Use Card components
   <Card interactive>
     <CardHeader>
       <CardTitle>Title</CardTitle>
     </CardHeader>
   </Card>
   ```

5. **✅ Replace manual buttons and icons:**
   ```typescript
   // Replace manual buttons
   <button className="btn btn-primary">...</button>
   
   // Use Button component
   <Button variant="primary" iconBefore="buy">Buy</Button>
   ```

6. **✅ Replace CSS Grid with Grid component:**
   ```typescript
   // Replace manual CSS grids
   <div className="grid grid-3">...</div>
   
   // Use Grid component
   <Grid columns="auto-fit-3" gap="lg">...</Grid>
   ```

7. **✅ Update spacing and layout:**
   ```typescript
   // Replace manual spacing
   <div className="section">...</div>
   
   // Use Section component
   <Section title="Section Title">...</Section>
   ```

### Common Patterns to Replace

| **Old Pattern** | **New Pattern** |
|----------------|-----------------|
| `className="nav-button"` | `<Button variant="ghost" iconBefore="home">Home</Button>` |
| `className="status-positive"` | `<Badge variant="success">Success</Badge>` |
| `className="card"` | `<Card>` |
| `className="grid-3"` | `<Grid columns="auto-fit-3">` |
| `<User size={24} />` | `<Icon name="user" size="lg" />` |
| Manual CSS spacing | `<Section spacing="lg">` |

---

## 🎨 Available Components Quick Reference

### Layout Components
- `<Layout>` - Full page layout with header
- `<PageContainer>` - Main content wrapper with title
- `<Section>` - Content sections with consistent spacing

### Content Components  
- `<Card>` + sub-components - Flexible card layouts
- `<Grid>` - Responsive grid system
- `<Button>` - All button variants with icons
- `<Icon>` - Consistent iconography
- `<Badge>` - Status indicators and labels

### State Components
- `<LoadingState>` - Loading indicators
- `<EmptyState>` - Empty state with actions
- `<ErrorState>` - Error states with retry

### Header Options
```typescript
header={{
  currentPage: 'feed',        // Hide this nav item  
  showSearch: true,           // Show search bar
  hideNavigation: false,      // Hide all nav items
  title: "Custom Title"       // Override user info with title
}}
```

### Button Variants
```typescript
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button> 
<Button variant="danger">Delete</Button>
<Button variant="ghost">Subtle</Button>
```

### Badge Variants
```typescript
<Badge variant="success">Success</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="info">Info</Badge>
<Badge variant="trending">Hot</Badge>
<Badge variant="neutral">Neutral</Badge>
```

---

## 🚀 Testing Your Migration

1. **Start small** - Pick one page to migrate first
2. **Test responsive behavior** - Check mobile/desktop layouts  
3. **Verify accessibility** - Ensure screen readers work
4. **Check consistency** - Compare with other migrated pages
5. **Performance check** - Ensure no layout shift or flashing

## 🎯 Result

After migration, you'll have:
- ✅ **Consistent headers** across all pages
- ✅ **Responsive design** that works on all screen sizes  
- ✅ **Accessible components** with proper ARIA labels
- ✅ **Easy maintenance** - update styles globally from one place
- ✅ **Developer experience** - Simple, intuitive component API

Your pages will look professional and consistent while being much easier to maintain and update! 