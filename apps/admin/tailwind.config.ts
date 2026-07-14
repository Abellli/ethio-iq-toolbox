import type { Config } from 'tailwindcss';

// Design tokens — Blueprint section 4.1. Do not add colors outside this palette;
// chart accents are reserved for data viz only, never UI chrome.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2196F3',
        'primary-tint': '#E3F2FD',
        surface: '#FFFFFF',
        text: {
          DEFAULT: '#1E293B', // primary text
          muted: '#64748B',   // secondary/muted text
        },
        border: '#E2E8F0', // hairline
        chart: {
          teal: '#14B8A6',
          coral: '#FB7185',
          amber: '#F59E0B',
          purple: '#8B5CF6',
        },
      },
      borderRadius: {
        card: '10px', // 8-12px per spec
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(30 41 59 / 0.04)', // subtle elevation only
      },
    },
  },
  plugins: [],
};
export default config;
