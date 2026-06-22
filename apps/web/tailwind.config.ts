import type { Config } from 'tailwindcss';
import { brand } from '@komuta/config';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: brand.colors.primary,
          fg: brand.colors.primaryForeground,
          accent: brand.colors.accent,
          success: brand.colors.success,
          warning: brand.colors.warning,
          danger: brand.colors.danger,
          muted: brand.colors.muted,
          bg: brand.colors.background,
          fg2: brand.colors.foreground,
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
        'card-hover': '0 2px 4px 0 rgb(15 23 42 / 0.06), 0 12px 28px -6px rgb(15 23 42 / 0.14)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};

export default config;
