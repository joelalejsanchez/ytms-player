function withOpacity(variableName) {
  return `color-mix(in srgb, var(${variableName}) calc(<alpha-value> * 100%), transparent)`;
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },
      colors: {
        background: withOpacity("--background"),
        foreground: withOpacity("--foreground"),
        card: {
          DEFAULT: withOpacity("--card"),
          foreground: withOpacity("--card-foreground"),
        },
        popover: {
          DEFAULT: withOpacity("--popover"),
          foreground: withOpacity("--popover-foreground"),
        },
        primary: {
          DEFAULT: withOpacity("--primary"),
          foreground: withOpacity("--primary-foreground"),
        },
        secondary: {
          DEFAULT: withOpacity("--secondary"),
          foreground: withOpacity("--secondary-foreground"),
        },
        muted: {
          DEFAULT: withOpacity("--muted"),
          foreground: withOpacity("--muted-foreground"),
        },
        accent: {
          DEFAULT: withOpacity("--accent"),
          foreground: withOpacity("--accent-foreground"),
        },
        destructive: {
          DEFAULT: withOpacity("--destructive"),
          foreground: withOpacity("--destructive-foreground"),
        },
        border: withOpacity("--border"),
        input: withOpacity("--input"),
        ring: withOpacity("--ring"),
        surface: withOpacity("--card"),
        panel: withOpacity("--card"),
        slate: {
          50: withOpacity("--slate-50"),
          100: withOpacity("--slate-100"),
          200: withOpacity("--slate-200"),
          300: withOpacity("--slate-300"),
          400: withOpacity("--slate-400"),
          500: withOpacity("--slate-500"),
          600: withOpacity("--slate-600"),
          700: withOpacity("--slate-700"),
          800: withOpacity("--slate-800"),
          900: withOpacity("--slate-900"),
          950: withOpacity("--slate-950"),
        },
      },
    },
  },
  plugins: [],
};
