import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  base: process.env.GITHUB_PAGES === "true" ? "/aether-api/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "../assets"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist-website"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
