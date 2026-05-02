import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(222 47% 4%)',
        foreground: 'hsl(210 40% 98%)',
        card: 'hsl(222 47% 8%)',
        'card-foreground': 'hsl(210 40% 98%)',
        border: 'hsl(217 33% 18%)',
        input: 'hsl(217 33% 18%)',
        primary: 'hsl(191 91% 47%)',
        'primary-foreground': 'hsl(222 47% 4%)',
        secondary: 'hsl(217 33% 18%)',
        'secondary-foreground': 'hsl(210 40% 98%)',
        muted: 'hsl(217 33% 14%)',
        'muted-foreground': 'hsl(215 20% 65%)',
        accent: 'hsl(262 83% 58%)',
        'accent-foreground': 'hsl(210 40% 98%)',
        success: 'hsl(142 71% 45%)',
        warning: 'hsl(38 92% 50%)',
        danger: 'hsl(0 84% 60%)'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.15), 0 18px 50px rgba(34,211,238,0.12)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem'
      },
      backgroundImage: {
        grid: 'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)'
      }
    }
  },
  plugins: []
} satisfies Config;
