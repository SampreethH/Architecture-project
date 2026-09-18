import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        onyx: {
          950: "#0A0B0E",
          900: "#0E1014",
          800: "#12141A",
          700: "#181B22",
          600: "#1E222C",
        },
        champagne: {
          DEFAULT: "#D4AF37",
          soft: "#C5A880",
          mist: "#E8D5A3",
        },
        titanium: {
          DEFAULT: "#8E9299",
          dim: "#6B6F76",
          bright: "#C8CCD3",
        },
        cobalt: {
          DEFAULT: "#00E5FF",
          dim: "#00A8B8",
        },
        crimson: {
          DEFAULT: "#FF4B4B",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(212, 175, 55, 0.12)",
        cobalt: "0 0 28px rgba(0, 229, 255, 0.18)",
        glass: "0 24px 80px rgba(0, 0, 0, 0.45)",
      },
      backdropBlur: {
        glass: "24px",
        heavy: "40px",
      },
      letterSpacing: {
        arch: "0.28em",
        telemetry: "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;
