/**
 * Design Tokens - Single source of truth for design system
 * Matches values defined in tailwind.config.ts and global.css
 */

export const colors = {
  // Core Brand & Semantic Colors
  green: '#0F7950',
  greenHover: '#0d6b47',
  red: '#BB0006',
  coralRed: '#ef4444',
  coralBright: '#ff5252',
  yellow: '#FED031',
  lightGreen: '#CDF546',
  pink: '#FFB5D9',
  orange: '#FF7602',
  
  // Enhanced brand colors
  limeGreen: '#9fd4a3',
  limeBright: '#9aff4d',
  limeDark: '#8fdd47',
  emeraldGreen: '#25A766',
  softPurple: '#BFB6D7',
  accentPurple: '#9F93C4',
  softBlue: '#63b3ed',
  softYellow: '#FFD166',
  softAzure: '#3A86FF',
  
  // Neutrals
  offWhite: '#F2EDE8',
  black: '#131313',
  lightGray: '#7F7F7F',
  mediumGray: '#B8B7B7',
  white: '#FFFFFF',
  
  // Background system
  bg: {
    white: '#F1F0EC',
    light: '#f7f9fc',
    card: '#F1F0EC',
    elevated: '#f4f6fa',
    section: '#f0f2f5',
  },
  
  // Text colors
  text: {
    primary: '#1a1a1a',
    secondary: '#555555',
    tertiary: '#7a7a7a',
    black: '#000000',
  },
  
  // Status colors
  success: '#9fd4a3',
  error: '#ff6b6b',
  warning: '#FFD166',
  info: '#63b3ed',
  
  // Borders
  border: {
    primary: '#000000',
    secondary: '#ebebeb',
    accent: '#c7c7c7',
    white: '#ffffff',
  },
} as const;

export const typography = {
  fontSize: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '28px',
    '4xl': '36px',
    '5xl': '48px',
    '6xl': '64px',
    '7xl': '72px',
    '8xl': '96px',
  },
  
  fontFamily: {
    primary: ['Noto Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
    opinion: ['Noto Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
    number: ['Newsreader', 'Roboto', 'sans-serif'],
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '40px',
  '4xl': '48px',
  '5xl': '64px',
  '6xl': '80px',
  '7xl': '110px',
  '8xl': '128px',
} as const;

export const borderRadius = {
  xs: '0px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  pill: '100px',
} as const;

export const shadows = {
  card: '0 2px 8px rgba(0, 0, 0, 0.1)',
  cardHover: '0 4px 16px rgba(0, 0, 0, 0.1)',
  elevated: '0 8px 25px rgba(0, 0, 0, 0.12)',
  glow: '0 4px 8px rgba(34, 197, 94, 0.5)',
} as const;

export const transitions = {
  duration: '200ms',
  timing: 'ease-out',
  default: 'all 200ms ease-out',
} as const;

export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Semantic color mappings for consistent usage
export const semanticColors = {
  // Actions
  buy: colors.limeGreen,
  sell: colors.coralRed,
  neutral: colors.text.secondary,
  
  // Status
  positive: colors.emeraldGreen,
  negative: colors.coralRed,
  warning: colors.softYellow,
  info: colors.softBlue,
  
  // Market trends
  trending: colors.emeraldGreen,
  declining: colors.coralRed,
  stable: colors.text.secondary,
  
  // User types
  user: colors.text.primary,
  bot: colors.accentPurple,
  ai: colors.softAzure,
} as const;

// Component variants
export const componentVariants = {
  button: {
    primary: {
      bg: colors.limeGreen,
      text: colors.text.black,
      hover: colors.limeDark,
    },
    secondary: {
      bg: colors.softPurple,
      text: colors.bg.card,
      hover: colors.accentPurple,
    },
    danger: {
      bg: colors.coralRed,
      text: colors.bg.card,
      hover: colors.coralBright,
    },
    ghost: {
      bg: 'transparent',
      text: colors.text.primary,
      hover: colors.bg.section,
    },
  },
  
  card: {
    default: {
      bg: colors.bg.card,
      border: colors.border.primary,
      shadow: shadows.card,
    },
    elevated: {
      bg: colors.bg.elevated,
      border: colors.border.secondary,
      shadow: shadows.elevated,
    },
  },
  
  status: {
    success: {
      bg: colors.success,
      text: colors.text.black,
    },
    error: {
      bg: colors.error,
      text: colors.white,
    },
    warning: {
      bg: colors.warning,
      text: colors.text.black,
    },
    info: {
      bg: colors.info,
      text: colors.white,
    },
  },
} as const;

// Grid system
export const grid = {
  columns: {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  },
  
  responsive: {
    autoFit2: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2',
    autoFit3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    autoFit4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    autoFit5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  },
} as const;

// Export types for TypeScript support
export type ColorKeys = keyof typeof colors;
export type SpacingKeys = keyof typeof spacing;
export type FontSizeKeys = keyof typeof typography.fontSize;
export type IconSizeKeys = keyof typeof iconSizes; 