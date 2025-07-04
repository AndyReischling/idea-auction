# Design System Requirements
## Consistent Color Scheme & Iconographic System

### Overview
This document outlines the requirements for implementing a unified design system across all pages of the idea-auction application, ensuring consistent colors, icons, and visual hierarchy that can be easily maintained from a single location.

---

## 🎨 Color System Requirements

### 1. Centralized Color Management
**Requirement**: All colors must be defined in a single location for easy maintenance.

**Implementation**:
- Create `app/lib/design-tokens.ts` for TypeScript color definitions
- Maintain existing CSS custom properties in `app/global.css`
- Ensure all components reference the centralized color system

### 2. Color Palette Structure

#### Primary Brand Colors
```typescript
// Current brand colors to maintain
--lime-green: #9fd4a3      // Primary brand color
--lime-bright: #9aff4d     // Accent/highlight
--lime-dark: #8fdd47       // Darker variant
--emerald-green: #25A766   // Success states
--coral-red: #ff6b6b       // Error/danger states
--coral-bright: #ff5252    // Bright error variant
```

#### Secondary Colors
```typescript
--soft-purple: #BFB6D7     // Secondary brand color
--accent-purple: #9F93C4   // Purple accent
--soft-blue: #63b3ed       // Info states
--soft-yellow: #FFD166     // Warning states
--soft-azure: #3A86FF      // Link/action color
```

#### Background System
```typescript
--bg-white: #F1F0EC        // Main background
--bg-light: #f7f9fc        // Light background
--bg-card: #F1F0EC         // Card backgrounds
--bg-elevated: #f4f6fa     // Elevated surfaces
--bg-section: #f0f2f5      // Section backgrounds
```

#### Text Colors
```typescript
--text-primary: #1a1a1a    // Primary text
--text-secondary: #555555  // Secondary text
--text-tertiary: #7a7a7a   // Tertiary text
--text-black: #000000      // High contrast text
```

#### Status Colors
```typescript
--success: #9fd4a3         // Success states
--error: #ff6b6b           // Error states
--warning: #FFD166         // Warning states
--info: #63b3ed            // Info states
```

### 3. Color Usage Guidelines

#### Semantic Color Mapping
- **Buy/Accept**: `--lime-green` / `--emerald-green`
- **Sell/Reject**: `--coral-red` / `--coral-bright`
- **Neutral/Stable**: `--text-secondary` / `--text-tertiary`
- **Warning**: `--soft-yellow` / `--warning`
- **Info**: `--soft-blue` / `--info`
- **Purple Actions**: `--soft-purple` / `--accent-purple`

#### Accessibility Requirements
- Maintain minimum 4.5:1 contrast ratio for text
- Use `--text-black` for high-contrast situations
- Ensure color is not the only indicator of state

---

## 🎯 Iconographic System Requirements

### 1. Icon Library Standardization

#### Primary Icon Library
**Requirement**: Standardize on Phosphor Icons for consistency

**Current Usage Analysis**:
- ✅ Already using `@phosphor-icons/react` in most components
- ✅ Consistent icon sizing and styling
- ❌ Some inconsistency in icon choices across similar actions

#### Icon Categories & Mappings

##### Navigation Icons
```typescript
const navigationIcons = {
  home: 'House',
  feed: 'RssSimple',
  generate: 'RocketLaunch',
  opinion: 'ChatCircle',
  admin: 'Gear',
  profile: 'User',
  search: 'MagnifyingGlass'
}
```

##### Action Icons
```typescript
const actionIcons = {
  buy: 'TrendUp',
  sell: 'TrendDown',
  bet: 'Ticket',
  short: 'TrendDown',
  generate: 'RocketLaunch',
  submit: 'Check',
  cancel: 'X',
  edit: 'Pencil',
  delete: 'Trash',
  share: 'Share',
  copy: 'Copy'
}
```

##### Status Icons
```typescript
const statusIcons = {
  success: 'CheckCircle',
  error: 'XCircle',
  warning: 'Warning',
  info: 'Info',
  loading: 'Spinner',
  empty: 'Package'
}
```

##### User/Authentication Icons
```typescript
const userIcons = {
  user: 'User',
  bot: 'Robot',
  ai: 'Sparkle',
  community: 'Users',
  avatar: 'UserCircle'
}
```

### 2. Icon Implementation Standards

#### Size System
```typescript
const iconSizes = {
  xs: 12,    // Very small indicators
  sm: 16,    // Small icons
  md: 20,    // Standard icons
  lg: 24,    // Large icons
  xl: 32,    // Extra large icons
  xxl: 48    // Hero icons
}
```

#### Icon Component Requirements
```typescript
interface IconProps {
  name: keyof typeof iconMappings;
  size?: keyof typeof iconSizes;
  color?: string;
  className?: string;
  weight?: 'regular' | 'bold' | 'fill' | 'duotone';
}
```

### 3. Emoji System (Alternative Icons)

#### Emoji Usage Guidelines
- Use emojis sparingly for personality and quick recognition
- Maintain consistent emoji-to-action mappings
- Provide fallback for systems without emoji support

#### Standardized Emoji Mappings
```typescript
const emojiMappings = {
  // User types
  user: '👤',
  bot: '🤖',
  ai: '✨',
  
  // Actions
  buy: '📈',
  sell: '📉',
  bet: '🎯',
  short: '📉',
  win: '🏆',
  loss: '💥',
  
  // Status
  rising: '🚀',
  falling: '💥',
  stable: '➡️',
  highVol: '⚡',
  medVol: '🔄',
  lowVol: '🔒'
}
```

---

## 🏗️ Implementation Requirements

### 1. File Structure
```
app/
├── lib/
│   ├── design-tokens.ts          # TypeScript color definitions
│   ├── icon-system.ts            # Icon mappings and utilities
│   └── emoji-system.ts           # Emoji mappings
├── components/
│   ├── ui/
│   │   ├── Icon.tsx              # Reusable icon component
│   │   ├── ColorProvider.tsx     # Context for color theming
│   │   └── ThemeToggle.tsx       # Theme switching (future)
│   └── existing-components/
└── global.css                    # CSS custom properties
```

### 2. Component Requirements

#### Icon Component
```typescript
// app/components/ui/Icon.tsx
export const Icon = ({ 
  name, 
  size = 'md', 
  color, 
  className,
  weight = 'regular' 
}: IconProps) => {
  // Implementation with Phosphor Icons
}
```

#### Color Provider
```typescript
// app/components/ui/ColorProvider.tsx
export const ColorProvider = ({ children }: { children: React.ReactNode }) => {
  // Context for color theming and management
}
```

### 3. Migration Strategy

#### Phase 1: Centralize Colors
1. Create `design-tokens.ts` with all color definitions
2. Update `global.css` to reference the centralized tokens
3. Audit all components for hardcoded colors

#### Phase 2: Standardize Icons
1. Create icon mapping system
2. Implement reusable Icon component
3. Replace inconsistent icon usage across components

#### Phase 3: Implement Theme System
1. Add color provider context
2. Create theme switching capability
3. Add dark mode support (future enhancement)

### 4. Quality Assurance

#### Color Consistency Checklist
- [ ] All colors defined in `design-tokens.ts`
- [ ] No hardcoded colors in components
- [ ] Consistent semantic color usage
- [ ] Accessibility contrast ratios met
- [ ] Color-blind friendly palette

#### Icon Consistency Checklist
- [ ] All icons use Phosphor library
- [ ] Consistent icon sizing system
- [ ] Semantic icon mappings established
- [ ] Reusable Icon component implemented
- [ ] Fallback icons for edge cases

---

## 📋 Specific Component Updates Required

### 1. Sidebar Component
- **File**: `app/components/Sidebar.tsx`
- **Updates**: Standardize icon usage, ensure consistent color application
- **Icons**: Navigation, trend indicators, user types

### 2. Feed Page
- **File**: `app/feed/page.tsx`
- **Updates**: Activity icons, status indicators, color consistency
- **Icons**: Activity types, user badges, transaction icons

### 3. Opinion Pages
- **File**: `app/opinion/[id]/page.tsx`
- **Updates**: Chart colors, status indicators, action buttons
- **Icons**: Trend indicators, action buttons, user types

### 4. Generate Page
- **File**: `app/generate/page.tsx`
- **Updates**: Button colors, status indicators, form styling
- **Icons**: Action buttons, status indicators

### 5. User Pages
- **File**: `app/users/page.tsx`
- **Updates**: Transaction icons, status colors, badge styling
- **Icons**: Transaction types, user indicators

---

## 🎯 Success Criteria

### Color System
- ✅ All colors managed from single location
- ✅ Consistent semantic color usage across all pages
- ✅ Easy color modification process
- ✅ Accessibility standards met

### Icon System
- ✅ Unified icon library (Phosphor Icons)
- ✅ Consistent icon sizing and styling
- ✅ Semantic icon mappings established
- ✅ Reusable icon component implemented

### Maintainability
- ✅ Single source of truth for design tokens
- ✅ Easy to modify colors globally
- ✅ Consistent component API
- ✅ Clear documentation and guidelines

---

## 🚀 Future Enhancements

### 1. Dark Mode Support
- Extend color system to support dark theme
- Implement theme switching capability
- Maintain accessibility in both themes

### 2. Advanced Icon System
- Custom icon library for brand-specific icons
- Icon animation system
- Icon accessibility improvements

### 3. Design Token Management
- Integration with design tools (Figma, Sketch)
- Automated token generation
- Version control for design tokens

---

## 📝 Implementation Notes

### Priority Order
1. **High Priority**: Centralize color system
2. **High Priority**: Standardize icon usage
3. **Medium Priority**: Implement reusable components
4. **Low Priority**: Add theme switching capability

### Estimated Effort
- **Color System**: 2-3 days
- **Icon System**: 3-4 days
- **Component Updates**: 2-3 days
- **Testing & QA**: 1-2 days

### Dependencies
- Phosphor Icons library (already installed)
- TypeScript for type safety
- CSS custom properties support
- React Context for theming

---

*This document serves as the single source of truth for design system implementation. All changes should be documented and version controlled.* 