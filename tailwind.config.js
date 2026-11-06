/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecf8f1', 100: '#d2eedd', 200: '#a6dcbc', 300: '#6fc294', 400: '#3ba46c',
          500: '#178a51', 600: '#0b6e3f', 700: '#0a5833', 800: '#09452a', 900: '#073822', 950: '#032014',
        },
        gold: {
          50: '#fdf8e7', 100: '#faefc4', 200: '#f5dd85', 300: '#efc84a', 400: '#e6b325',
          500: '#d19a12', 600: '#b0780c', 700: '#8c590e', 800: '#744713', 900: '#633c15',
        },
        danger: {
          50: '#fdf0f0', 100: '#fbdcdc', 200: '#f6b9b9', 300: '#ee8a8a', 400: '#e25555',
          500: '#d12f2f', 600: '#b42020', 700: '#951c1c', 800: '#7b1c1c', 900: '#671d1d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        logo: ['Montserrat', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
      },
    },
  },
  plugins: [],
};
