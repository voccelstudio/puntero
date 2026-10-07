import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// `VITE_BASE` permite apuntar el build a una ruta base distinta (p. ej.
// "/puntero-5-preview/" para el preview de GitHub Pages). Por defecto "/"
// con lo que la app funciona en el root o en rutas derivadas del base.
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "icons.svg", "apple-touch-icon.png", "pwa-maskable-512.png"],
      manifest: {
        name: "Puntero 5.0 — Gestión de obra",
        short_name: "Puntero",
        description: "Presupuesto, finanzas, cronograma y gente de tu obra, 100% local.",
        lang: "es",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#141414",
        theme_color: "#ffcc00",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg,png}"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});