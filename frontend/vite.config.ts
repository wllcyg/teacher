import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// 前端 5173，后端 8001；/api 走代理联调；支持 PWA 离线安装与全屏应用模式
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "pwa-192x192.svg", "pwa-512x512.svg", "sw-notification.js"],
      manifest: {
        name: "教师工作台",
        short_name: "教师工作台",
        description: "专为中小学教师设计的高效教学、考勤与学情工作台",
        theme_color: "#4f46e5",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        importScripts: ["/sw-notification.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          // 读多写少的基础数据表（学生名单、课表、考试项目、家长、值日表）：
          // 先用缓存立即返回，同时后台发起真实请求更新缓存，解决断网时仍能看到数据的问题。
          // 注意：只对 GET 生效，且不包括考勤/成绩等需要实时性的接口（academic/behavior/attendance/todos/comms）。
          {
            urlPattern: /\/api\/tables\/(students|schedule|items|parents|duties)(\/\d+)?(\?.*)?$/,
            method: "GET",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-readonly",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 系统全局配置（称呼/学期/作息），变动频率低，同样用 SWR
          {
            urlPattern: /\/api\/settings(\?.*)?$/,
            method: "GET",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-readonly",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // 手动分包：把体量最大的第三方库从共享 vendor 包里拆出来，
        // 避免单个 vendor chunk 过大、并充分利用浏览器缓存：
        // antd 本体变动频率低于业务代码，单独分包后业务代码更新时不会使它失效重新下载。
        // 注意：antd/react/icons/rc-* 内部互相依赖（icons 需要 antd context，rc-* 是 antd 实现细节），
        // 强行拆开会产生循环 chunk 警告并反而变大，所以这部分交给 Vite 自动处理；
        // 只把与 UI 框架无耗合、变动频率低的独立工具库拆出来单独缓存。
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("dayjs") || id.includes("axios") || id.includes("zustand") || id.includes("boring-avatars")) {
            return "utils-vendor";
          }
          if (id.includes("@tanstack")) return "query-vendor";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://127.0.0.1:8002",
        changeOrigin: true,
      },
    },
  },
});
