import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        ripple: {
          "0%": { transform: "scale(0.35)", opacity: "0.6" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 1.6s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        fadeUp: "fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 8s linear infinite",
        ripple: "ripple 2.6s ease-out infinite",
        radar: "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
