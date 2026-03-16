import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4A90D9',
          light: '#E8F0FE',
        },
        surface: '#FFFFFF',
        background: '#F5F6F8',
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B7280',
        success: '#22C55E',
        warning: '#EAB308',
        error: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
