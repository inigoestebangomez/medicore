import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        /* ── SURFACE ── */
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

        /* ── PRIMARY ── */
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

        /* ── SECONDARY ── */
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

        /* ── TERTIARY ── */
        tertiary: {
          DEFAULT: 'var(--color-tertiary)',
          on: 'var(--color-on-tertiary)',
          container: 'var(--color-tertiary-container)',
          'on-container': 'var(--color-on-tertiary-container)',
        },

        /* ── ERROR ── */
        error: {
          DEFAULT: 'var(--color-error)',
          on: 'var(--color-on-error)',
          container: 'var(--color-error-container)',
          'on-container': 'var(--color-on-error-container)',
        },

        /* ── BACKGROUND ── */
        background: {
          DEFAULT: 'var(--color-background)',
          on: 'var(--color-on-background)',
        },

        /* ── OUTLINE ── */
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
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        dropdown: 'var(--shadow-dropdown)',
        modal: 'var(--shadow-modal)',
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        'container-max': 'var(--container-max)',
        gutter: 'var(--gutter)',
      },
      maxWidth: {
        container: 'var(--container-max)',
      },
      fontSize: {
        /* display-lg: 32px / 24px mobile */
        'display-lg': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        /* headline-md: 20px */
        'headline-md': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        /* body-lg: 16px */
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        /* body-md: 14px */
        'body-md': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        /* body-sm: 13px */
        'body-sm': ['0.8125rem', { lineHeight: '1.4', fontWeight: '400' }],
        /* code-md: 13px */
        'code-md': ['0.8125rem', { lineHeight: '1.5', fontWeight: '450' }],
        /* label-caps: 11px */
        'label-caps': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};

export default config;
