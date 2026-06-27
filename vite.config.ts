import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// 读取 package.json 获取版本号
const packageJsonPath = path.resolve(__dirname, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // ─── Demo 模式（VITE_DEMO）──────────────────────────────────────────────
  // `vite --mode demo` / `vite build --mode demo` 触发。用于 GenshinUID-docs
  // 主页内嵌「可交互控制台」：免登录 + Mock 数据 + 纯静态产物。
  //  · base：dev serve 用 "/"（便于 iframe 直连 http://localhost:8080/#/…）；
  //          build 用 "/hub/"（同源烤进 docs 的 /hub/ 下，HashRouter 深链开箱即用）。
  //  · 产物落到 dist-demo/，再由 docs 的 scripts/hub.mjs 拷进 public/hub/。
  const isDemo = mode === "demo";
  return {
  base: isDemo
    ? command === "serve"
      ? "/"
      : "/hub/"
    : mode === "development"
      ? "/"
      : "/app/",
  define: {
    PACKAGE_VERSION: JSON.stringify(packageJson.version),
    // 编译期常量：只有 demo 模式为 true，普通 build 下为 undefined → 分支被 tree-shake。
    "import.meta.env.VITE_DEMO": JSON.stringify(isDemo),
  },
  server: {
    port: 8080,
    strictPort: false,
    proxy: {
      // 开发模式下：前端独立运行，代理 /api 到后端
      // 生产模式（后端挂载）：前端通过后端的 /app 路径访问
      "/api": {
        target: "http://localhost:8765",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://localhost:8765",
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // 自定义插件：构建完成后生成 version.json
    {
      name: "generate-version-json",
      closeBundle() {
        // 读取 package.json 获取版本号
        const packageJsonPath = path.resolve(__dirname, "package.json");
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        
        const versionInfo = {
          version: packageJson.version || "0.0.0",
          buildTime: new Date().toISOString(),
          mode: mode,
        };
        
        // 写入 version.json 到产物目录（demo 模式落到 dist-demo）
        const distPath = path.resolve(__dirname, isDemo ? "dist-demo" : "dist");
        fs.writeFileSync(
          path.join(distPath, "version.json"),
          JSON.stringify(versionInfo, null, 2),
          "utf-8"
        );
        console.log(`[generate-version-json] Generated version.json:`, versionInfo);
      },
    },
    // 仅 demo 模式：把演示用静态资源拷进产物根目录。
    // 这些资源（demo-memes / demo-plugin-icons / demo-themes，约 2.5M）只有 GenshinUID-docs
    // 的内嵌「可交互控制台」Demo 用到，故移出 public/——否则普通 `vite build`（后端部署用）
    // 也会被 Vite 原样带上，白白增重。改由本插件按 mode 条件拷贝：
    //   · `vite build --mode demo` → 拷进 dist-demo/，运行时 URL 仍是 `${BASE_URL}demo-*/…`（不变）。
    //   · 普通 `vite build` → 不触发，dist/ 不含这些资源。
    isDemo && {
      name: "copy-demo-assets",
      closeBundle() {
        const srcDir = path.resolve(__dirname, "demo-assets");
        const destDir = path.resolve(__dirname, "dist-demo");
        if (!fs.existsSync(srcDir)) {
          console.warn(`[copy-demo-assets] 跳过：未找到 ${srcDir}`);
          return;
        }
        // cpSync 把 srcDir 的子项拷进 destDir（dist-demo/demo-memes/… 等），与原 public/ 路径一致。
        fs.cpSync(srcDir, destDir, { recursive: true });
        console.log(`[copy-demo-assets] 已将 demo-assets/ 拷入 dist-demo/`);
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: isDemo ? "dist-demo" : "dist",
    emptyOutDir: true,
    // 启用tree-shaking优化
    rollupOptions: {
      output: {
        // 代码分割策略
        manualChunks: {
          // 将大型依赖单独打包
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'chart-vendor': ['recharts'],
          'virtual': ['@tanstack/react-virtual'],
        },
        // 启用gzip压缩
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          const info = name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // 压缩选项 - 使用esbuild（Vite默认，无需额外依赖）
    minify: 'esbuild',
    esbuildOptions: {
      drop: ['console', 'debugger'], // 移除console和debugger
    },
    // 源码映射控制
    sourcemap: false,
    // CSS优化
    cssMinify: true,
    // 资源内联阈值（小于4KB的资源内联为base64）
    assetsInlineLimit: 4096,
  },
  };
});
