import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0d12",
        haze: "#f4f1ea",
        ember: "#f25f4c"
      }
    }
  },
  plugins: []
};

export default config;
