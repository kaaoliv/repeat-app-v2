import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Chassi do deck — fundo quase preto com leve subtom arroxeado
        chassis: "#17151c",
        // Painéis (cards) — um degrau acima do chassi
        panel: "#221f29",
        "panel-raised": "#2b2733",
        // Âmbar — cor do LED de VU meter, o acento principal
        amber: "#e8a33d",
        "amber-dim": "#8a6423",
        // Vermelho de pico — só pra estados raros (erro)
        peak: "#d6524a",
        // Texto
        paper: "#ede6dc",
        "paper-muted": "#948d82",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        counter: ["var(--font-counter)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};
export default config;
