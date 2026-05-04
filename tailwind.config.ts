import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        kratos: {
          DEFAULT: '#ffad33',
          50:  '#fff8eb',
          100: '#ffefc7',
          200: '#ffdb8a',
          300: '#ffc34d',
          400: '#ffad33',
          500: '#f98f0a',
          600: '#dd6e05',
          700: '#b74e08',
          800: '#953d0f',
          900: '#7a3310',
          950: '#461805',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
