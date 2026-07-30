import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#F5F5F7',
        surface: '#FFFFFF',
        'surface-elevated': '#F0F0F5',
        primary: '#1D1D1F',
        secondary: '#6E6E73',
        tertiary: '#AEAEB2',
        brand: '#C1121F',
        'brand-hover': '#a50f1a',
        blue: '#0071E3',
        green: '#1C7A2E',
        amber: '#A05A00',
        danger: '#D60014',
      },
      borderRadius: {
        card: '16px',
        button: '10px',
        input: '10px',
      },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Display', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
