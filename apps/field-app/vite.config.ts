import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@enact-ui/react/styles": path.resolve(
        __dirname,
        "node_modules/@enact-ui/react/dist/styles",
      ),
    },
  },
  server: {
    port: 3001,
    // Listen on all interfaces so Tailscale / LAN can reach :3001 (e.g. http://100.x.x.x:3001).
    host: true,
    // ngrok (and similar) send a non-localhost Host header
    allowedHosts: true,
    proxy: {
      // When VITE_API_URL is empty, the SPA calls /v1 on the Vite origin; forward to the API.
      "/v1": { target: "http://127.0.0.1:3000", changeOrigin: true },
      // Uploaded audio/images are served by the API from apps/api/uploads.
      "/uploads": { target: "http://127.0.0.1:3000", changeOrigin: true },
    },
  },
});
