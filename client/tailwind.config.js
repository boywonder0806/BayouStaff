/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark-but-warm navy layers
        void:  '#071520',   // root bg — deep ocean
        deep:  '#0C2035',   // card surface
        shell: '#143050',   // elevated / hover
        rim:   '#1E4568',   // border tone

        // Text
        ink:      '#E8F4FF',   // primary — bright cool white
        fog:      '#5A8AAA',   // muted
        'fog-hi': '#8BB8D4',   // mid-tone

        // Brand
        navy: { DEFAULT: '#1B2A6B', light: '#2A3D9A', dark: '#111B47' },
        cyan: {
          DEFAULT: '#00C8FF',   // bumped up — electric aqua
          light:   '#7DE8FF',
          dark:    '#009DC8',
          glow:    'rgba(0,200,255,0.20)',
        },
        gold: {
          DEFAULT: '#FFD200',   // vivid sun-yellow
          dark:    '#E6BB00',
          glow:    'rgba(255,210,0,0.20)',
        },

        // Department palette — vivid on dark
        aq:   '#00C8FF',   // Aquatics — electric blue
        fb:   '#FF7A00',   // Food & Beverage — hot orange
        gs:   '#B455FF',   // Guest Services — bright violet
        mgmt: '#FFD200',   // Management — sun gold
        cc:   '#2DDE98',   // Cleaning Crew — mint green
      },
      fontFamily: {
        heading: ['Montserrat', 'Arial Black', 'sans-serif'],
        body:    ['Nunito', 'Arial', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Mono', 'monospace'],
      },
      fontSize: {
        '10': '0.625rem',
      },
      letterSpacing: {
        widest2: '0.2em',
      },
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(0,200,255,0.30)',
        'glow-gold': '0 0 24px rgba(255,210,0,0.25)',
        'glow-sm':   '0 0 12px rgba(0,200,255,0.18)',
      },
    },
  },
  plugins: [],
};
