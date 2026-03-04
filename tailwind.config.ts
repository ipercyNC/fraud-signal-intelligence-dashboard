import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f6f7fb',
        panel: '#ffffff',
        ink: '#1f2937',
        accent: '#0f766e',
      },
    },
  },
  plugins: [],
} satisfies Config;
