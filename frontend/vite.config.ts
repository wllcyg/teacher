import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 前端 5173，后端 8000；/api 走代理联调
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
