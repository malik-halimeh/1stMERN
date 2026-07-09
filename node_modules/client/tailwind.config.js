/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#EA580C',
        'primary-dark': '#9A3412',
        // Pressed/active state one step darker than primary-dark hover
        'primary-active': '#7C2D12',
        secondary: '#9A3412',
        accent: '#0D9488',
        background: '#FAFAF9',
        surface: '#FFFFFF',
        card: '#FFFFFF',
        'dashboard-section-bg': '#F5F5F4',
        'text-primary': '#1C1917',
        'text-secondary': '#57534E',
        'text-muted': '#A8A29E',
        'text-disabled': '#D6D3D1',
        success: '#16A34A',
        warning: '#CA8A04',
        danger: '#DC2626',
        info: '#0284C7',
        // Tint-base tokens: components already use bg-*-bg/NN opacity classes,
        // but these tokens were never defined, so those backgrounds silently
        // rendered transparent. Defined as the full-strength semantic colors
        // so the existing opacity modifiers produce the intended tints.
        'primary-bg': '#EA580C',
        'success-bg': '#16A34A',
        'danger-bg': '#DC2626',
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
