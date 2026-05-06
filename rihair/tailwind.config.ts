import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/domains/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#0A0A0A",
          gold: "#C9A84C",
          "gold-light": "#E8C97A",
          "gold-dark": "#A67C35",
          white: "#FAFAF8",
          "off-white": "#F5F4F0",
          cream: "#EDE8DF",
        },
        surface: {
          primary: "#0A0A0A",
          secondary: "#141414",
          tertiary: "#1E1E1E",
          elevated: "#242424",
        },
        text: {
          primary: "#FAFAF8",
          secondary: "#B0A99A",
          muted: "#6B6459",
          inverse: "#0A0A0A",
        },
        border: {
          subtle: "#2A2A2A",
          default: "#3A3A3A",
          emphasis: "#C9A84C",
        },
        feedback: {
          success: "#4CAF50",
          warning: "#FF9800",
          error: "#F44336",
          info: "#2196F3",
        },
      },

      fontFamily: {
        display: ["var(--font-cormorant)", ...fontFamily.serif],
        body: ["var(--font-dm-sans)", ...fontFamily.sans],
        mono: ["var(--font-dm-mono)", ...fontFamily.mono],
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.625rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.875rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.375rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.75rem" }],
        "5xl": ["3rem", { lineHeight: "3.5rem" }],
        "6xl": ["3.75rem", { lineHeight: "4.25rem" }],
        "7xl": ["4.5rem", { lineHeight: "5rem" }],
        "8xl": ["6rem", { lineHeight: "6.5rem" }],
        "9xl": ["8rem", { lineHeight: "8.5rem" }],
      },

      spacing: {
        "4.5": "1.125rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "17": "4.25rem",
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
      },

      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },

      boxShadow: {
        "gold-sm": "0 1px 3px rgba(201, 168, 76, 0.15)",
        gold: "0 4px 16px rgba(201, 168, 76, 0.2)",
        "gold-lg": "0 8px 32px rgba(201, 168, 76, 0.25)",
        "gold-xl": "0 16px 48px rgba(201, 168, 76, 0.3)",
        "elevation-1": "0 2px 8px rgba(0,0,0,0.4)",
        "elevation-2": "0 4px 16px rgba(0,0,0,0.5)",
        "elevation-3": "0 8px 32px rgba(0,0,0,0.6)",
        "elevation-4": "0 16px 48px rgba(0,0,0,0.7)",
        "inner-gold": "inset 0 1px 0 rgba(201, 168, 76, 0.2)",
      },

      backgroundImage: {
        "gradient-gold":
          "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
        "gradient-gold-radial":
          "radial-gradient(ellipse at center, #E8C97A 0%, #C9A84C 60%, #A67C35 100%)",
        "gradient-dark": "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)",
        "gradient-surface":
          "linear-gradient(180deg, #141414 0%, #1E1E1E 100%)",
        "gradient-hero":
          "linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.6) 60%, rgba(10,10,10,0.95) 100%)",
        "shimmer":
          "linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.1) 50%, transparent 100%)",
      },

      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-up": "fadeUp 0.6s ease-out",
        "slide-in": "slideIn 0.4s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
        shimmer: "shimmer 2s infinite",
        "spin-slow": "spin 3s linear infinite",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(201, 168, 76, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(201, 168, 76, 0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },

      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
        "1200": "1200ms",
        "1500": "1500ms",
      },

      zIndex: {
        "60": "60",
        "70": "70",
        "80": "80",
        "90": "90",
        "100": "100",
      },

      screens: {
        "2xs": "360px",
        xs: "480px",
        "3xl": "1920px",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
    require("tailwindcss-animate"),
  ],
};

export default config;
