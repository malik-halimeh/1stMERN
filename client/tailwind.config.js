/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-dark': '#1E3A8A',
        secondary: '#1E3A8A',
        accent: '#F97316',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        card: '#FFFFFF',
        'dashboard-section-bg': '#F1F5F9',
        'text-primary': '#111827',
        'text-secondary': '#4B5563',
        'text-muted': '#9CA3AF',
        'text-disabled': '#D1D5DB',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
        info: '#0EA5E9',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        // Display 40-48px bold
        display: ['48px', { lineHeight: '1.2', fontWeight: '700' }],
        'display-mobile': ['40px', { lineHeight: '1.2', fontWeight: '700' }],
        // H1 32px semibold
        h1: ['32px', { lineHeight: '1.25', fontWeight: '600' }],
        // H2 28px semibold
        h2: ['28px', { lineHeight: '1.3', fontWeight: '600' }],
        // H3 22px medium
        h3: ['22px', { lineHeight: '1.35', fontWeight: '500' }],
        // Section title 18-20px medium
        'section-title': ['20px', { lineHeight: '1.4', fontWeight: '500' }],
        'section-title-sm': ['18px', { lineHeight: '1.4', fontWeight: '500' }],
        // Body 16px regular
        body: ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        // Secondary text 14px
        secondary: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        // Labels 13-14px medium
        label: ['14px', { lineHeight: '1.5', fontWeight: '500' }],
        'label-sm': ['13px', { lineHeight: '1.5', fontWeight: '500' }],
        // Caption 12px
        caption: ['12px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      spacing: {
        '0': '0px',
        '1': '4px',
        '2': '8px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
      borderRadius: {
        btn: '10px',
        card: '14px',
        input: '10px',
        dropdown: '10px',
        image: '12px',
        modal: '18px',
      },
      boxShadow: {
        // Level 1 (cards) = very subtle
        level1: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        // Level 2 (dropdowns/popovers) = slightly stronger
        level2: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
        // Level 3 (modals) = moderate
        level3: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}
