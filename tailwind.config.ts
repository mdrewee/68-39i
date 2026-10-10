import type { Config } from 'tailwindcss';

export default <Config>{
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Accent: Olivine Green (organic, muted, olive tones)
        olive: {
          50: '#F4F6EE',
          100: '#E5EBD8',
          200: '#D0DCB8',
          300: '#B5C896',
          400: '#9AB973',
          500: '#8A9A5B',
          600: '#73834A',
          700: '#556B2F',
          800: '#3F4F23',
          900: '#2A3517',
          950: '#19200D',
        },
        // Secondary Accent: Ochre Yellow (Warm earthy ochre / mustard clay)
        ochre: {
          50: '#FDF8F0',
          100: '#FBF1E1',
          200: '#F5DEBC',
          300: '#E9BA86',
          400: '#D99B26',
          500: '#CC7722',
          600: '#B56017',
          700: '#944912',
          800: '#773B13',
          900: '#4E2805',
          950: '#2E1502',
        },
        // Backgrounds & Surface: Warm linen / bone / warm sand
        sand: {
          50: '#FAF8F5',
          100: '#F8F6F0',
          200: '#F0ECE1',
          300: '#DDD6C6',
          400: '#C4BAA3',
          500: '#A99D84',
          600: '#8B8069',
          700: '#6C6351',
          800: '#4D473A',
          900: '#322E26',
        },
        // Typography, Accents & Dark Elements: Deep organic ink & warm espresso
        ink: {
          50: '#F5F4F1',
          100: '#E6E4DF',
          200: '#CCC8BF',
          300: '#ADA79B',
          400: '#8C867A',
          500: '#6E695F',
          600: '#534F47',
          700: '#3D3A34',
          800: '#2B2823',
          900: '#1F1E1B',
          950: '#1A1917',
        },
      },
      fontFamily: {
        sans: ['"Alexandria"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        display: ['"Alexandria"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'tactile-sm': '2px 2px 0px #1A1917',
        'tactile': '3px 3px 0px #1A1917',
        'tactile-md': '4px 4px 0px #1A1917',
        'tactile-lg': '6px 6px 0px #1A1917',
        'tactile-xl': '8px 8px 0px #1A1917',
        'tactile-olive': '3px 3px 0px #556B2F',
        'tactile-ochre': '3px 3px 0px #773B13',
        'tactile-pressed': '1px 1px 0px #1A1917',
      },
      borderRadius: {
        'tactile': '0.875rem',
      },
    },
  },
  plugins: [],
};
