/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#09080f',
        'bg-surface': '#100e1a',
        'bg-elevated': '#18152a',
        'bg-overlay': '#1f1b30',
        'border-subtle': '#1e1a2e',
        'border-default': '#2a2440',
        'border-strong': '#3d3560',
        accent: '#7c3aed',
        'accent-hover': '#6d28d9',
        'accent-light': '#a78bfa',
        'accent-muted': '#2d1f52',
        'accent-border': '#4c3580',
        'text-primary': '#f0eaff',
        'text-secondary': '#9d8fbb',
        'text-muted': '#5a4f73',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#f87171',
      },
      fontFamily: {
        base: ['Outfit', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
      },
      boxShadow: {
        glow: '0 0 30px rgba(124,58,237,0.3)',
      },
    },
  },
  plugins: [],
};
