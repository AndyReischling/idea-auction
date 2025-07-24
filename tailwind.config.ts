import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Custom color palette from global.css
      colors: {
        // Core Brand & Semantic Colors
        green: '#0F7950',
        'green-hover': '#0d6b47',
        red: '#BB0006',
        'coral-red': '#ef4444',
        'coral-bright': '#ff5252',
        yellow: '#FED031',
        'light-green': '#CDF546',
        pink: '#FFB5D9',
        orange: '#FF7602',
        
        // Enhanced brand colors from design requirements
        'lime-green': '#9fd4a3',
        'lime-bright': '#9aff4d',
        'lime-dark': '#8fdd47',
        'emerald-green': '#25A766',
        'soft-purple': '#BFB6D7',
        'accent-purple': '#9F93C4',
        'soft-blue': '#63b3ed',
        'soft-yellow': '#FFD166',
        'soft-azure': '#3A86FF',
        
        // Neutrals
        'off-white': '#F2EDE8',
        black: '#131313',
        'light-gray': '#7F7F7F',
        'medium-gray': '#B8B7B7',
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
      },
      
      // Typography system
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
      
      // Font families
      fontFamily: {
        primary: ['Noto Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        opinion: ['Noto Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        number: ['Newsreader', 'Roboto', 'sans-serif'],
      },
      
      // Spacing system
      spacing: {
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
      },
      
      // Border radius system
      borderRadius: {
        xs: '0px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        pill: '100px',
      },
      
      // Transition system
      transitionDuration: {
        DEFAULT: '200ms',
      },
      
      transitionTimingFunction: {
        DEFAULT: 'ease-out',
      },
      
      // Box shadows
      boxShadow: {
        card: '0 2px 8px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.1)',
        elevated: '0 8px 25px rgba(0, 0, 0, 0.12)',
        glow: '0 4px 8px rgba(34, 197, 94, 0.5)',
      },
      
      // Animation keyframes
      keyframes: {
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        priceFlashUp: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.3)' },
          '50%': { transform: 'scale(1.02)', boxShadow: '0 0 0 10px rgba(34, 197, 94, 0.1)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(34, 197, 94, 0)' },
        },
        priceFlashDown: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.3)' },
          '50%': { transform: 'scale(1.02)', boxShadow: '0 0 0 10px rgba(239, 68, 68, 0.1)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
        },
        glow: {
          from: { boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)' },
          to: { boxShadow: '0 4px 8px rgba(34, 197, 94, 0.5)' },
        },
        bounceUp: {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-3px)' },
          '60%': { transform: 'translateY(-2px)' },
        },
        bounceDown: {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(3px)' },
          '60%': { transform: 'translateY(2px)' },
        },
      },
      
      // Animation utilities
      animation: {
        spin: 'spin 1s linear infinite',
        pulse: 'pulse 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in-up': 'slideInUp 0.6s ease-out backwards',
        'price-flash-up': 'priceFlashUp 1s ease-out',
        'price-flash-down': 'priceFlashDown 1s ease-out',
        glow: 'glow 2s ease-in-out infinite alternate',
        'bounce-up': 'bounceUp 1s ease-out',
        'bounce-down': 'bounceDown 1s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config

export default config 