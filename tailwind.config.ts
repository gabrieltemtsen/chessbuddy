import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic border colour — maps to the --border CSS variable
        border: "var(--border)",
        // Chess board colors
        board: {
          light: "#F0D9B5",
          dark: "#B58863",
          highlight: "#F6F669",
          "highlight-dark": "#CDD26A",
          move: "#CAE9FF",
          check: "#FF6B6B",
        },
        // Brand colors
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        // CRC / Circles accent
        circles: {
          green: "#00C853",
          teal: "#00BCD4",
          purple: "#7C3AED",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-light": "bounce 1s infinite",
        "spin-slow": "spin 3s linear infinite",
        "board-appear": "boardAppear 0.5s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        boardAppear: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      boxShadow: {
        "board": "0 20px 60px -10px rgba(0,0,0,0.4)",
        "card-hover": "0 8px 30px rgba(0,0,0,0.12)",
        "glow-green": "0 0 20px rgba(34, 197, 94, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
