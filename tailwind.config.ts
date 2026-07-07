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
        background: '#111111',
        surface: '#1a1a1a',
        'surface-elevated': '#222222',
        primary: '#f5f5f7',
        secondary: '#98989d',
        tertiary: '#48484a',
        brand: '#C1121F',
        'brand-hover': '#a50f1a',
        blue: '#0a84ff',
        green: '#30d158',
        amber: '#ff9f0a',
        danger: '#ff453a',
      },
      borderRadius: {
        card: '18px',
        button: '12px',
        input: '12px',
      },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Display', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
