import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** API used by the dev server proxy (the API runs on :3000 with `pnpm dev`). */
const API_TARGET = process.env.VITE_API_PROXY ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": { target: API_TARGET, changeOrigin: false } },
  },
  preview: { port: 4173 },
  // Pre-bundle the map stack up front: react-map-gl imports maplibre dynamically, and a
  // re-optimization mid-load invalidates the already loaded chunks.
  optimizeDeps: {
    include: [
      "maplibre-gl",
      "react-map-gl/maplibre",
      "@deck.gl/core",
      "@deck.gl/layers",
      "@deck.gl/aggregation-layers",
      "@deck.gl/mapbox",
    ],
  },
});
