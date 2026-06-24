import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 40px rgba(244, 114, 182, 0.22)",
        "soft-panel": "0 24px 80px rgba(0, 0, 0, 0.35)"
      },
      backgroundImage: {
        "aurora-night":
          "radial-gradient(circle at 18% 16%, rgba(244, 114, 182, 0.28), transparent 28%), radial-gradient(circle at 82% 8%, rgba(56, 189, 248, 0.20), transparent 30%), radial-gradient(circle at 70% 86%, rgba(167, 139, 250, 0.24), transparent 34%), linear-gradient(135deg, #09090f 0%, #151225 45%, #07111f 100%)"
      }
    }
  },
  plugins: []
};

export default config;
