/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#090d16",
        surface: "#111827",
        panel: "#1e293b",
        border: "#334155",
        accent: {
          DEFAULT: "#ef4444",
          hover: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};
