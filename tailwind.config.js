/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light cellar theme: one wine-red accent scale.
        gold: {
          50: '#fff1f3', 100: '#ffe4e8', 200: '#fecdd6', 300: '#fda4b3',
          400: '#ef6a82', 500: '#c8102e', 600: '#a80d27', 700: '#880c22',
          800: '#6f101f', 900: '#4b0b16',
        },
        // Existing semantic class names remain, but map to accessible light surfaces.
        cave: {
          50: '#202124', 100: '#565b63', 200: '#6b7280', 300: '#9ca3af',
          400: '#d1d5db', 500: '#e5e7eb', 600: '#f3f1ed', 700: '#faf9f7',
          800: '#fffdfa', 900: '#f7f4ef', 950: '#ffffff',
        },
        // 互換性のため wine も残す（既存コード用）
        wine: {
          50:  '#FBF7EF',
          100: '#F5EBD6',
          200: '#EAD5A9',
          300: '#DFBE7C',
          400: '#D3A855',
          500: '#C9A876',
          600: '#B8935A',
          700: '#96763F',
          800: '#C9A876',
          900: '#0A0A0F',
          950: '#050508',
        },
        parchment: '#FFFDF9',
        ink: '#202124',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
