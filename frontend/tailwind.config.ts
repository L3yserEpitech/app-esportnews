import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors
        'primary-900': 'var(--color-primary-900)',
        'primary-800': 'var(--color-primary-800)',
        'primary-600': 'var(--color-primary-600)',

        // Text colors
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'text-inverse': 'var(--color-text-inverse)',
        'text-accent': 'var(--color-text-accent)',

        // Background colors
        'bg-primary': 'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-tertiary': 'var(--color-bg-tertiary)',
        'bg-surface': 'var(--color-bg-surface)',

        // Accent colors
        'accent': 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-alt': 'var(--color-accent-alt)',

        // Border colors
        'border-primary': 'var(--color-border-primary)',
        'border-secondary': 'var(--color-border-secondary)',
        'border-accent': 'var(--color-border-accent)',
        'border-muted': 'var(--color-border-muted)',

        // Status colors
        'status-live': 'var(--color-status-live)',
        'status-upcoming': 'var(--color-status-upcoming)',
        'status-finished': 'var(--color-status-finished)',
        'status-success': 'var(--color-status-success)',

        // Card colors
        'card-bg': 'var(--color-card-bg)',
        'card-border': 'var(--color-card-border)',
        'card-text': 'var(--color-card-text)',

        // Input colors
        'input-bg': 'var(--color-input-bg)',
        'input-border': 'var(--color-input-border)',
        'input-text': 'var(--color-input-text)',
      },
      backgroundColor: {
        primary: 'var(--color-bg-primary)',
        secondary: 'var(--color-bg-secondary)',
        tertiary: 'var(--color-bg-tertiary)',
        surface: 'var(--color-bg-surface)',
        card: 'var(--color-card-bg)',
        input: 'var(--color-input-bg)',
      },
      textColor: {
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
        inverse: 'var(--color-text-inverse)',
        accent: 'var(--color-text-accent)',
      },
      borderColor: {
        primary: 'var(--color-border-primary)',
        secondary: 'var(--color-border-secondary)',
        accent: 'var(--color-border-accent)',
        muted: 'var(--color-border-muted)',
      },
    },
  },
  plugins: [],
};

export default config;
