import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d0d0f",
        surface: "#17171a",
        accent: "#f4f1ea",
      },
    },
  },
  plugins: [],
};
export default config;
