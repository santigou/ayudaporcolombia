/** @type {import('tailwindcss').Config} */
export default {
  // 'class' = el modo oscuro se controla con la clase `.dark` en <html>. Un
  // script inline en index.html la añade/quito antes del primer paint (sin
  // destello). Por defecto sigue la preferencia del sistema; el usuario puede
  // override con el botón de la hamburguesa (persiste en localStorage).
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1d6f5c",
          dark: "#144d40",
        },
      },
      // Parpadeo on/off (para el indicador "En vivo" del chat en tiempo real).
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
      },
      animation: {
        blink: "blink 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
