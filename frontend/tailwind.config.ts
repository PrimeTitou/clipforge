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
        border: "#e5e7eb",
        surface: "#f9fafb",
        "surface-2": "#f3f4f6",
        accent: "#6366f1",
        muted: "#6b7280",
        success: "#10b981",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};
export default config;
