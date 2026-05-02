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
          primary: "#4A6FA5",
          bg: "#FAFAF7",
          tint: "#EEF2F7",
          text: "#1F2937",
          footer: "#F7F9FC",
          border: "#D1DCF0",
        },
      },
      fontFamily: {
        heading: ["var(--font-cormorant)", "Georgia", "serif"],
        body: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        f10: "12px",
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
