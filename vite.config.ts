import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4174"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"]
  }
});
