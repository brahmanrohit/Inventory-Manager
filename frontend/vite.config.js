import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config. The dev server proxies /api to the backend so local development
// works without CORS friction. In production the API base URL is read from
// the VITE_API_BASE_URL environment variable at build time.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
