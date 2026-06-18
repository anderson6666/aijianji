/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 深色主题色板
        'cine-bg': '#0a0a0f',
        'cine-panel': '#12121a',
        'cine-card': '#1a1a28',
        'cine-surface': '#222236',
        'cine-border': '#2a2a3c',
        'cine-border-light': '#3a3a50',
        // 强调色
        'neon-cyan': '#00d4ff',
        'neon-magenta': '#ff3366',
        'neon-green': '#00ff88',
        'neon-yellow': '#ffcc00',
        'neon-purple': '#a855f7',
        // 文字颜色
        'text-primary': '#e0e0e8',
        'text-secondary': '#8888a0',
        'text-muted': '#5a5a70',
        'text-highlight': '#00d4ff',
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.6)' },
        },
        'glow-pulse-magenta': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 51, 102, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 51, 102, 0.6)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-left': 'slide-in-left 0.25s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-in-up': 'slide-in-up 0.2s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'glow-pulse-magenta': 'glow-pulse-magenta 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
