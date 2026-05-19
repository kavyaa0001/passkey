import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#111115",
        surface: "#1C1C22",
        "surface-light": "#2A2A35",
        primary: "#8D55F3",
        "primary-light": "#A57CF4",
        success: "#34C759",
        error: "#FF4444",
        warning: "#FF9500",
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
      },
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
};
export default config;
