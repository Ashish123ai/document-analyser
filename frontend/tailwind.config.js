/** Palette: cool paper, navy ink, one blue for actions, highlighter yellow for anything quoted from the document. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        ink: { DEFAULT: 'rgb(var(--ink) / <alpha-value>)', soft: 'rgb(var(--ink-soft) / <alpha-value>)' },
        muted: 'rgb(var(--muted) / <alpha-value>)',
        rule: 'rgb(var(--rule) / <alpha-value>)',
        seal: { DEFAULT: 'rgb(var(--seal) / <alpha-value>)', dark: 'rgb(var(--seal-dark) / <alpha-value>)', tint: 'rgb(var(--seal-tint) / <alpha-value>)' },
        mark: 'rgb(var(--mark) / <alpha-value>)',
        high: { DEFAULT: 'rgb(var(--high) / <alpha-value>)', tint: 'rgb(var(--high-tint) / <alpha-value>)' },
        med: { DEFAULT: 'rgb(var(--med) / <alpha-value>)', tint: 'rgb(var(--med-tint) / <alpha-value>)' },
        low: { DEFAULT: 'rgb(var(--low) / <alpha-value>)', tint: 'rgb(var(--low-tint) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
