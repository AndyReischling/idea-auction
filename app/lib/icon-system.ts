/**
 * Icon System - Centralized icon mappings using Phosphor Icons
 * Ensures consistent icon usage across the application
 */

import {
  // Navigation icons
  House,
  RssSimple,
  RocketLaunch,
  ChatCircle,
  Gear,
  User,
  MagnifyingGlass,
  
  // Action icons
  TrendUp,
  TrendDown,
  Ticket,
  Check,
  X,
  Pencil,
  Trash,
  Share,
  Copy,
  Plus,
  Minus,
  
  // Status icons
  CheckCircle,
  XCircle,
  Warning,
  Info,
  Spinner,
  Package,
  
  // User/Authentication icons
  Robot,
  Sparkle,
  Users,
  UserCircle,
  SignIn,
  SignOut,
  
  // Chart and data icons
  ChartLineUp,
  ChartLineDown,
  Eye,
  Clock,
  Fire,
  Crown,
  Trophy,
  
  // UI icons
  CaretDown,
  CaretUp,
  CaretLeft,
  CaretRight,
  DotsThree,
  List,
  GridFour,
  
  // Additional utility icons
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  Heart,
  Star,
  Bookmark,
  
  type Icon,
} from '@phosphor-icons/react';

// Navigation icon mappings
export const navigationIcons = {
  home: House,
  feed: RssSimple,
  generate: RocketLaunch,
  opinion: ChatCircle,
  admin: Gear,
  profile: User,
  search: MagnifyingGlass,
} as const;

// Action icon mappings
export const actionIcons = {
  buy: TrendUp,
  sell: TrendDown,
  bet: Ticket,
  short: TrendDown,
  generate: RocketLaunch,
  submit: Check,
  cancel: X,
  edit: Pencil,
  delete: Trash,
  share: Share,
  copy: Copy,
  add: Plus,
  remove: Minus,
} as const;

// Status icon mappings
export const statusIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: Warning,
  info: Info,
  loading: Spinner,
  empty: Package,
} as const;

// User/Authentication icon mappings
export const userIcons = {
  user: User,
  bot: Robot,
  ai: Sparkle,
  community: Users,
  avatar: UserCircle,
  signIn: SignIn,
  signOut: SignOut,
} as const;

// Chart and data icon mappings
export const dataIcons = {
  chartUp: ChartLineUp,
  chartDown: ChartLineDown,
  trendUp: TrendUp,
  trendDown: TrendDown,
  view: Eye,
  time: Clock,
  trending: Fire,
  winner: Crown,
  trophy: Trophy,
} as const;

// UI icon mappings
export const uiIcons = {
  caretDown: CaretDown,
  caretUp: CaretUp,
  caretLeft: CaretLeft,
  caretRight: CaretRight,
  menu: DotsThree,
  list: List,
  grid: GridFour,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  notification: Bell,
  favorite: Heart,
  rating: Star,
  bookmark: Bookmark,
} as const;

// Combine all icon mappings
export const iconMappings = {
  ...navigationIcons,
  ...actionIcons,
  ...statusIcons,
  ...userIcons,
  ...dataIcons,
  ...uiIcons,
} as const;

// Icon categories for easier organization
export const iconCategories = {
  navigation: navigationIcons,
  action: actionIcons,
  status: statusIcons,
  user: userIcons,
  data: dataIcons,
  ui: uiIcons,
} as const;

// Icon size mappings (matches design tokens)
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Icon weight options
export const iconWeights = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'] as const;

// Type definitions
export type IconName = keyof typeof iconMappings;
export type IconSize = keyof typeof iconSizes;
export type IconWeight = typeof iconWeights[number];
export type IconComponent = Icon;

// Helper function to get icon component by name
export function getIcon(name: IconName): IconComponent {
  return iconMappings[name];
}

// Helper function to get icon size in pixels
export function getIconSize(size: IconSize): number {
  return iconSizes[size];
}

// Semantic icon mappings for common use cases
export const semanticIconMappings = {
  // Market actions
  positive: iconMappings.trendUp,
  negative: iconMappings.trendDown,
  neutral: iconMappings.remove,
  
  // User types
  humanUser: iconMappings.user,
  botUser: iconMappings.bot,
  aiUser: iconMappings.ai,
  
  // Status states
  loading: iconMappings.loading,
  success: iconMappings.success,
  error: iconMappings.error,
  warning: iconMappings.warning,
  
  // Navigation
  back: iconMappings.arrowLeft,
  forward: iconMappings.arrowRight,
  up: iconMappings.arrowUp,
  down: iconMappings.arrowDown,
  
  // Actions
  create: iconMappings.add,
  update: iconMappings.edit,
  delete: iconMappings.delete,
  view: iconMappings.view,
  
} as const;

// Default icon props
export const defaultIconProps = {
  size: iconSizes.md,
  weight: 'regular' as IconWeight,
} as const;

/**
 * Usage Examples:
 * 
 * import { getIcon, iconSizes } from '@/lib/icon-system';
 * 
 * const BuyIcon = getIcon('buy');
 * <BuyIcon size={iconSizes.lg} weight="bold" />
 * 
 * Or using semantic mapping:
 * const PositiveIcon = semanticIconMappings.positive;
 * <PositiveIcon size={20} />
 */ 