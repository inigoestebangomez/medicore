import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ═════════════════════════════════════════════════════════════════════
         COLORS — Section 8. New aqua/zinc/clinical palettes plus the legacy
         Material token names rewired to the new CSS variables so existing
         components (bg-surface-*, text-on-surface-variant, border-outline,
         primary-container, ...) resolve through the dark-first palette.
         ═════════════════════════════════════════════════════════════════════ */
      colors: {
        /* ── AQUA MÉDICO ── */
        aqua: {
          50: '#EBF9FC',
          100: '#D4F5FA',
          200: '#A8EBF4',
          300: '#67D9EC',
          400: '#22C4DC',
          500: '#0EA5C0',
          600: '#0A8499',
          700: '#076778',
          800: '#044B5A',
          900: '#022D35',
          950: '#011A1F',
        },
        /* ── ZINC NEUTRALES ── */
        zinc: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
          950: '#09090B',
        },
        /* ── SEÑALÉTICA CLÍNICA ── */
        clinical: {
          critical: 'var(--critical)',
          warning: 'var(--warning)',
          success: 'var(--success)',
          info: 'var(--info)',
          draft: 'var(--draft)',
        },

        /* ── LEGACY SURFACE (rewired to dark-first tokens) ── */
        surface: {
          DEFAULT: 'var(--color-surface)',
          dim: 'var(--color-surface-dim)',
          bright: 'var(--color-surface-bright)',
          lowest: 'var(--color-surface-container-lowest)',
          low: 'var(--color-surface-container-low)',
          container: 'var(--color-surface-container)',
          high: 'var(--color-surface-container-high)',
          highest: 'var(--color-surface-container-highest)',
          variant: 'var(--color-surface-variant)',
        },
        'on-surface': {
          DEFAULT: 'var(--color-on-surface)',
          variant: 'var(--color-on-surface-variant)',
        },
        'inverse-surface': {
          DEFAULT: 'var(--color-inverse-surface)',
          on: 'var(--color-inverse-on-surface)',
        },

        /* ── LEGACY PRIMARY (rewired to aqua) ── */
        primary: {
          DEFAULT: 'var(--color-primary)',
          on: 'var(--color-on-primary)',
          container: 'var(--color-primary-container)',
          'on-container': 'var(--color-on-primary-container)',
          inverse: 'var(--color-inverse-primary)',
          fixed: 'var(--color-primary-fixed)',
          'fixed-dim': 'var(--color-primary-fixed-dim)',
          'on-fixed': 'var(--color-on-primary-fixed)',
          'on-fixed-variant': 'var(--color-on-primary-fixed-variant)',
        },

        /* ── LEGACY SECONDARY (rewired to aqua) ── */
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          on: 'var(--color-on-secondary)',
          container: 'var(--color-secondary-container)',
          'on-container': 'var(--color-on-secondary-container)',
          fixed: 'var(--color-secondary-fixed)',
          'fixed-dim': 'var(--color-secondary-fixed-dim)',
          'on-fixed': 'var(--color-on-secondary-fixed)',
          'on-fixed-variant': 'var(--color-on-secondary-fixed-variant)',
        },

        /* ── LEGACY TERTIARY (rewired to zinc) ── */
        tertiary: {
          DEFAULT: 'var(--color-tertiary)',
          on: 'var(--color-on-tertiary)',
          container: 'var(--color-tertiary-container)',
          'on-container': 'var(--color-on-tertiary-container)',
        },

        /* ── LEGACY ERROR (rewired to critical) ── */
        error: {
          DEFAULT: 'var(--color-error)',
          on: 'var(--color-on-error)',
          container: 'var(--color-error-container)',
          'on-container': 'var(--color-on-error-container)',
        },

        /* ── LEGACY BACKGROUND (rewired) ── */
        background: {
          DEFAULT: 'var(--color-background)',
          on: 'var(--color-on-background)',
        },

        /* ── LEGACY OUTLINE (rewired) ── */
        outline: {
          DEFAULT: 'var(--color-outline)',
          variant: 'var(--color-outline-variant)',
        },
      },

      backgroundColor: {
        app: 'var(--app-background)',
        sidebar: 'var(--sidebar-background)',
        header: 'var(--header-background)',
      },
      textColor: {
        app: 'var(--app-foreground)',
        sidebar: 'var(--sidebar-foreground)',
      },
      borderColor: {
        header: 'var(--header-border)',
        DEFAULT: 'var(--border-default)',
        strong: 'var(--border-strong)',
        focus: 'var(--border-focus)',
      },

      /* ═════════════════════════════════════════════════════════════════════
         FONTS — Section 8. Geist + Geist Mono via Google Fonts CDN.
         `body` and `display` are legacy aliases kept for existing components.
         ═════════════════════════════════════════════════════════════════════ */
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'Fira Code', 'monospace'],
        body: ['Geist', 'system-ui', 'sans-serif'],
        display: ['Geist', 'system-ui', 'sans-serif'],
        'geist-sans': ['Geist', 'system-ui', 'sans-serif'],
      },

      /* ═════════════════════════════════════════════════════════════════════
         FONT SIZE — Section 8 type scale + legacy aliases.
         ═════════════════════════════════════════════════════════════════════ */
      fontSize: {
        xs: ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        sm: ['13px', { lineHeight: '18px', letterSpacing: '-0.005em' }],
        base: ['14px', { lineHeight: '20px', letterSpacing: '-0.01em' }],
        md: ['15px', { lineHeight: '22px', letterSpacing: '-0.01em' }],
        lg: ['17px', { lineHeight: '24px', letterSpacing: '-0.015em' }],
        xl: ['20px', { lineHeight: '28px', letterSpacing: '-0.02em' }],
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.025em' }],
        '3xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.03em' }],
        '4xl': ['38px', { lineHeight: '44px', letterSpacing: '-0.04em' }],
        /* legacy aliases used by existing components */
        'label-caps': ['11px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '700' }],
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.4', fontWeight: '400' }],
        'code-md': ['0.8125rem', { lineHeight: '1.5', fontWeight: '450' }],
        'headline-md': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        'display-lg': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
      },

      /* ═════════════════════════════════════════════════════════════════════
         RADIUS — Section 8 + legacy DEFAULT alias for bare `rounded`.
         ═════════════════════════════════════════════════════════════════════ */
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
        DEFAULT: '4px',
        full: '9999px',
      },

      /* ═════════════════════════════════════════════════════════════════════
         SHADOWS — Section 8 + legacy `dropdown` alias.
         ═════════════════════════════════════════════════════════════════════ */
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        modal: 'var(--shadow-modal)',
        'glow-aqua': 'var(--shadow-glow-aqua)',
        critical: 'var(--shadow-critical)',
        dropdown: 'var(--shadow-dropdown)',
      },

      /* ═════════════════════════════════════════════════════════════════════
         BACKDROP BLUR — Section 8.
         ═════════════════════════════════════════════════════════════════════ */
      backdropBlur: {
        glass: '20px',
        modal: '40px',
      },

      /* ═════════════════════════════════════════════════════════════════════
         BACKGROUND IMAGES — Section 8 gradients.
         ═════════════════════════════════════════════════════════════════════ */
      backgroundImage: {
        'page-gradient':
          'radial-gradient(ellipse at 20% 0%, rgba(10,132,153,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(14,165,192,0.08) 0%, transparent 60%)',
        'aqua-gradient': 'linear-gradient(135deg, #0A8499 0%, #0EA5C0 50%, #22C4DC 100%)',
        'card-featured-border':
          'linear-gradient(160deg, rgba(14,165,192,0.4) 0%, rgba(255,255,255,0.08) 40%, transparent 80%)',
      },

      /* ═════════════════════════════════════════════════════════════════════
         ANIMATION — Section 7 keyframes (declared in globals.css @layer components
         in later batches). Names referenced here.
         ═════════════════════════════════════════════════════════════════════ */
      animation: {
        'page-enter': 'page-enter 250ms cubic-bezier(0.16,1,0.3,1)',
        'critical-pulse': 'critical-pulse 2.5s ease-in-out infinite',
        skeleton: 'skeleton-shimmer 1.5s ease-in-out infinite',
        'fade-in': 'page-enter 200ms cubic-bezier(0.16,1,0.3,1)',
      },

      /* legacy spacing aliases kept for existing components */
      spacing: {
        xs: 'var(--spacing-xs)',
        'container-max': 'var(--container-max)',
        gutter: 'var(--gutter)',
      },
      maxWidth: {
        container: 'var(--container-max)',
      },
    },
  },
  plugins: [],
};

export default config;
