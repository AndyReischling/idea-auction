# Design System Usage Guide

## Overview

This design system provides a consistent, maintainable way to build UI components across the idea-auction application. It combines Tailwind CSS with reusable React components and centralized design tokens.

## 🏗️ Architecture

### Core Files
- `tailwind.config.ts` - Tailwind configuration with custom design tokens
- `app/lib/design-tokens.ts` - TypeScript design tokens (single source of truth)
- `app/lib/icon-system.ts` - Centralized icon mappings using Phosphor Icons
- `app/components/ui/` - Reusable UI components
- `app/global.css` - Base CSS and custom properties

### Import Structure
```typescript
// Import UI components
import { Button, Card, Icon, Badge, Grid } from '@/components/ui';

// Import design tokens (if needed)
import { colors, spacing, typography } from '@/lib/design-tokens';

// Import icon utilities
import { getIcon, iconSizes } from '@/lib/icon-system';
```

## 🎨 Color System

### Usage with Tailwind Classes
```typescript
// Background colors
<div className="bg-bg-card">...</div>
<div className="bg-lime-green">...</div>

// Text colors
<p className="text-text-primary">Primary text</p>
<p className="text-emerald-green">Success text</p>

// Border colors
<div className="border-border-primary">...</div>
```

### Usage with Design Tokens
```typescript
import { colors, semanticColors } from '@/lib/design-tokens';

// In styled components or inline styles
<div style={{ backgroundColor: colors.limeGreen }}>
<div style={{ color: semanticColors.positive }}>
```

### Semantic Color Classes
```typescript
// Status colors
<div className="text-status-positive">Positive trend</div>
<div className="text-status-negative">Negative trend</div>

// Market colors
<div className="text-emerald-green">Buy/Up</div>
<div className="text-coral-red">Sell/Down</div>
```

## 🔧 Components

### Button Component
```typescript
import { Button } from '@/components/ui';

// Basic usage
<Button variant="primary">Click me</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="danger">Delete</Button>
<Button variant="ghost">Subtle</Button>

// With icons
<Button iconBefore="buy" variant="primary">Buy Opinion</Button>
<Button iconAfter="arrowRight">Continue</Button>
<Button iconOnly="search" />

// Sizes and states
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>
<Button fullWidth>Full width</Button>
```

### Card Component
```typescript
import { Card, CardHeader, CardTitle, CardSubtitle, CardContent, CardFooter } from '@/components/ui';

// Basic card
<Card>
  <CardHeader>
    <CardTitle>Opinion Title</CardTitle>
    <CardSubtitle>by @username</CardSubtitle>
  </CardHeader>
  <CardContent>
    <p>Opinion content goes here...</p>
  </CardContent>
  <CardFooter>
    <Button size="sm">Action</Button>
  </CardFooter>
</Card>

// Variants
<Card variant="elevated" interactive>
<Card variant="outline" hoverable={false}>

// Custom padding
<Card padding="lg">
<Card padding="none">
```

### Icon Component
```typescript
import { Icon } from '@/components/ui';

// Basic usage
<Icon name="user" />
<Icon name="buy" size="lg" />
<Icon name="trending" size="xl" className="text-yellow" />

// Interactive icons
<Icon 
  name="share" 
  size="md" 
  onClick={() => handleShare()} 
  className="cursor-pointer hover:text-lime-green"
/>

// Accessibility
<Icon 
  name="success" 
  size="sm" 
  aria-label="Success indicator"
/>
```

### Badge Component
```typescript
import { Badge } from '@/components/ui';

// Basic variants
<Badge variant="success">Success</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="trending">Hot</Badge>

// With icons
<Badge variant="success" icon="success">Verified</Badge>
<Badge variant="info" icon="info">Notice</Badge>

// Sizes
<Badge size="sm">Small</Badge>
<Badge size="lg">Large</Badge>

// With dot indicator
<Badge variant="success" dot>Online</Badge>
```

### Grid Component
```typescript
import { Grid } from '@/components/ui';

// Responsive auto-fit grids
<Grid columns="auto-fit-3" gap="md">
  {items.map(item => <Card key={item.id}>...</Card>)}
</Grid>

// Fixed columns
<Grid columns={4} gap="lg">
  {items.map(item => <div key={item.id}>...</div>)}
</Grid>

// Different gaps
<Grid columns="auto-fit-2" gap="xs">  // Small gap
<Grid columns="auto-fit-4" gap="2xl"> // Large gap
```

## 🎯 Common Patterns

### Opinion Card
```typescript
<Card interactive>
  <CardHeader>
    <div className="flex-1">
      <CardTitle>{opinion.text}</CardTitle>
      <CardSubtitle>by @{opinion.author} • {timeAgo}</CardSubtitle>
    </div>
    <Badge variant="trending" icon="trending">Hot</Badge>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between">
      <div className="text-2xl font-bold font-number">${opinion.price}</div>
      <div className="flex items-center gap-1 text-emerald-green">
        <Icon name="trendUp" size="sm" />
        <span className="text-sm font-medium">+{opinion.change}%</span>
      </div>
    </div>
  </CardContent>
  <CardFooter>
    <div className="flex gap-2">
      <Button size="sm" variant="primary" iconBefore="buy">Buy</Button>
      <Button size="sm" variant="danger" iconBefore="sell">Sell</Button>
      <Button size="sm" variant="ghost" iconOnly="share" />
    </div>
  </CardFooter>
</Card>
```

### User Profile Summary
```typescript
<Card>
  <CardHeader>
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-soft-purple rounded-full flex items-center justify-center">
        <Icon name="user" size="lg" className="text-accent-purple" />
      </div>
      <div className="flex-1">
        <CardTitle>@{user.username}</CardTitle>
        <CardSubtitle>Portfolio: ${user.portfolio} • {user.opinions.length} opinions</CardSubtitle>
      </div>
      <Badge variant="success" icon="trophy">Top 10%</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <div className="flex justify-between items-center">
      <div className="text-center">
        <div className="text-lg font-bold text-emerald-green">+{user.return}%</div>
        <div className="text-xs text-text-tertiary">All Time</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold">{user.totalBets}</div>
        <div className="text-xs text-text-tertiary">Total Bets</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold">{user.winRate}%</div>
        <div className="text-xs text-text-tertiary">Win Rate</div>
      </div>
    </div>
  </CardContent>
</Card>
```

### Market Status Indicator
```typescript
const getStatusColor = (trend: 'up' | 'down' | 'neutral') => {
  switch (trend) {
    case 'up': return 'text-emerald-green';
    case 'down': return 'text-coral-red';
    default: return 'text-text-secondary';
  }
};

<div className="flex items-center gap-2">
  <Icon 
    name={trend === 'up' ? 'trendUp' : trend === 'down' ? 'trendDown' : 'remove'} 
    size="sm" 
    className={getStatusColor(trend)}
  />
  <span className={getStatusColor(trend)}>{changePercent}%</span>
  <Badge variant={trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'neutral'}>
    {trend.toUpperCase()}
  </Badge>
</div>
```

## 🔄 Migrating Existing Components

### Before (CSS Modules)
```typescript
import styles from './MyComponent.module.css';

function MyComponent() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Title</h3>
      </div>
      <div className={styles.content}>
        <p>Content</p>
      </div>
    </div>
  );
}
```

### After (Design System)
```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Content</p>
      </CardContent>
    </Card>
  );
}
```

## 📱 Responsive Design

### Grid Breakpoints
- `auto-fit-2`: 1 column on mobile, 2 on desktop
- `auto-fit-3`: 1 column on mobile, 2 on tablet, 3 on desktop
- `auto-fit-4`: 1 column on mobile, 2 on tablet, 3 on laptop, 4 on desktop
- `auto-fit-5`: 2 columns on mobile, 3 on tablet, 4 on laptop, 5 on desktop

### Responsive Utilities
```typescript
// Hide on mobile
<div className="hidden sm:block">Desktop only</div>

// Different sizes on different screens
<Button 
  size="sm" 
  className="sm:text-base lg:text-lg"
>
  Responsive button
</Button>

// Responsive grid gaps
<Grid 
  columns="auto-fit-3" 
  gap="sm" 
  className="lg:gap-lg"
>
```

## 🎨 Customization

### Extending Colors
Add new colors in `tailwind.config.ts`:
```typescript
colors: {
  // ... existing colors
  'brand-purple': '#8B5CF6',
  'custom-blue': '#0EA5E9',
}
```

### Custom Component Variants
```typescript
// In your component
const customVariantClasses = {
  'custom-variant': [
    'bg-brand-purple text-white',
    'hover:bg-purple-600',
  ],
};
```

### Design Token Override
```typescript
// Create component-specific tokens
const componentTokens = {
  ...colors,
  primary: colors.brandPurple, // Override for this component
};
```

## 🧪 Testing the Design System

View all components in action:
```typescript
// Create a demo page
import { DesignSystemDemo } from '@/components/ui/DesignSystemDemo';

// Add to your routing
<Route path="/design-system" component={DesignSystemDemo} />
```

## 📚 Available Icons

### Navigation
- `home`, `feed`, `generate`, `opinion`, `admin`, `profile`, `search`

### Actions  
- `buy`, `sell`, `bet`, `submit`, `cancel`, `edit`, `delete`, `share`, `copy`, `add`, `remove`

### Status
- `success`, `error`, `warning`, `info`, `loading`, `empty`

### User Types
- `user`, `bot`, `ai`, `community`, `avatar`, `signIn`, `signOut`

### Data & Charts
- `chartUp`, `chartDown`, `trendUp`, `trendDown`, `view`, `time`, `trending`, `winner`, `trophy`

### UI Elements
- `caretDown`, `caretUp`, `caretLeft`, `caretRight`, `menu`, `list`, `grid`
- `arrowUp`, `arrowDown`, `arrowLeft`, `arrowRight`, `notification`, `favorite`, `rating`, `bookmark`

## 🚀 Best Practices

1. **Always use the design system components** instead of creating custom styled divs
2. **Prefer Tailwind classes** over inline styles for consistency
3. **Use semantic color names** (e.g., `text-emerald-green` for positive, `text-coral-red` for negative)
4. **Leverage responsive utilities** for mobile-first design
5. **Use the Icon component** instead of importing Phosphor Icons directly
6. **Compose with Card sub-components** for consistent card layouts
7. **Use Grid component** for responsive layouts
8. **Apply semantic icon mappings** for common use cases

## 🔧 Troubleshooting

### Color not applying?
- Check if the color exists in `tailwind.config.ts`
- Ensure Tailwind is processing the file (add to `content` array)
- Use browser dev tools to verify the class is generated

### Icon not found?
- Check `app/lib/icon-system.ts` for available icon names
- Use the exact name from `iconMappings`
- Import the Icon component from the UI system

### Component not styling correctly?
- Ensure you're importing from `@/components/ui`
- Check if custom className is overriding component styles
- Verify Tailwind CSS is loaded properly

## 📖 More Examples

For complete examples and interactive demos, check:
- `app/components/ui/DesignSystemDemo.tsx`
- Individual component files in `app/components/ui/`
- Design system requirements: `DESIGN_SYSTEM_REQUIREMENTS.md` 