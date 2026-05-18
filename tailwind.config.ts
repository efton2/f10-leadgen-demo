import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        f10: {
          primary: "#E8A020",
          bg: "#0A1520",
          tint: "#162C42",
          text: "#F5EFE6",
          footer: "#060D16",
          border: "#264766",
        },
      },
      fontFamily: {
        heading: ["var(--font-cormorant)", "Georgia", "serif"],
        body: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        f10: "12px",
      },
      animation: {
        "fade-up": "fadeUp 350ms cubic-bezier(0.23, 1, 0.32, 1) both",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      spacing: {
        "4": "4px",
        "8": "8px",
        "12": "12px",
        "16": "16px",
        "24": "24px",
        "32": "32px",
        "48": "48px",
      },
    },
  },
  plugins: [],
};
export default config;
