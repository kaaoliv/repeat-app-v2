import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fundo quase preto com leve subtom frio (estilo Refract)
        bg: "#0c0c11",
        surface: "#16161d",
        "surface-2": "#1f1f28",
        "surface-3": "#282833",
        line: "rgba(255,255,255,0.08)",
        // Acento principal — violeta
        primary: "#7b61ff",
        "primary-soft": "#a394ff",
        // Acentos coloridos flutuantes (badges) — paleta multicor
        blue: "#3d9bff",
        coral: "#ff6a45",
        pink: "#ff5d8f",
        gold: "#ffc73a",
        teal: "#22d3a6",
        // Texto
        ink: "#f4f2f7",
        "ink-muted": "#97949f",
        "ink-faint": "#635f6d",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        badge: "0 2px 8px rgba(0,0,0,0.45)",
        card: "0 8px 24px rgba(0,0,0,0.35)",
        glow: "0 0 40px rgba(123,97,255,0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
