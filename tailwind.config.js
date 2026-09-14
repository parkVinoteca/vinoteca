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
        // Cave Note風 ゴールド/シャンパンカラー（アクセント）
        gold: {
          50:  '#FBF7EF',
          100: '#F5EBD6',
          200: '#EAD5A9',
          300: '#DFBE7C',
          400: '#D3A855',
          500: '#C9A876',
          600: '#B8935A',
          700: '#96763F',
          800: '#6E5729',
          900: '#4A3A1B',
        },
        // ダークネイビー/ブラック（背景）
        cave: {
          50:  '#E8E9ED',
          100: '#C5C7D1',
          200: '#8B8FA3',
          300: '#5C6078',
          400: '#3A3D52',
          500: '#252838',
          600: '#1A1C28',
          700: '#14151F',
          800: '#0F1017',
          900: '#0A0A0F',
          950: '#050508',
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
        parchment: '#0A0A0F',
        ink: '#F5EBD6',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
