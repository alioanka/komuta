/**
 * Komuta brand definition — the single source of truth for product name, colors
 * and copy used across the web app, emails and documents.
 */
export const brand = {
  name: 'Komuta',
  tagline: 'Tek komuta merkezi', // "A single command center"
  /** Primary brand palette (HSL-friendly hex). Refined, calm, operational. */
  colors: {
    primary: '#1E3A8A', // deep indigo — command/authority
    primaryForeground: '#FFFFFF',
    accent: '#0EA5E9', // sky — data/insight
    success: '#16A34A', // received (green) on the monitor
    warning: '#D97706', // pending confirmation (yellow)
    danger: '#DC2626', // missing (red)
    muted: '#64748B',
    background: '#F8FAFC',
    foreground: '#0F172A',
  },
  /** Placeholder logo (replace with real asset under apps/web/public). */
  logo: {
    src: '/logo.svg',
    alt: 'Komuta',
  },
  defaultLocale: 'tr' as const,
  supportedLocales: ['tr', 'en'] as const,
} as const;

export type Brand = typeof brand;
export type SupportedLocale = (typeof brand.supportedLocales)[number];
