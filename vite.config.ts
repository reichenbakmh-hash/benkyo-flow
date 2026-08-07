import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuration Vite pour Benkyo Flow.
// Build simple, statique, pensé pour un déploiement sur Cloudflare Workers
// (assets statiques servis par le Worker défini dans /worker/index.ts).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
