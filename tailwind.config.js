/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#1e293b",
          amber: "#f59e0b",
          green: "#22c55e",
          red: "#ef4444",
        },
        user: {
          sou: { bg: "#dbeafe", text: "#1d4ed8" },
          an: { bg: "#fce7f3", text: "#be185d" },
        },
      },
      fontFamily: {
        sans: ["'Hiragino Sans'", "'Noto Sans JP'", "sans-serif"],
      },
      maxWidth: {
        app: "520px",
      },
    },
  },
  plugins: [],
};
