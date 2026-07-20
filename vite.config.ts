import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// 读取 package.json 获取版本号
const packageJsonPath = path.resolve(__dirname, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

// ============================================================================
// stripThesvgVariantsPlugin
// ----------------------------------------------------------------------------
// `@thesvg/react/dist/{slug}.js` 每个图标文件都按下面这个固定模板生成：
//
//   import { forwardRef, createElement } from 'react';
//   const _variants = { default: {...}, mono: {...}, light: {...}, dark: {...} };
//   const <Name> = forwardRef(function <Name>(...) { ... });
//   export default <Name>;
//
// 全库大约 800+ 个图标、6,400+ 个文件的 React + SVG path data 体积很大，并且
// 我们业务侧 (`mcp-icon-lookup.tsx`) 只用 `variant="mono"` 一种主题。
// 其它 4-5 个 variants 在前端运行时不参与渲染，但对 Rollup 来说它们仍然占据
// 体积，结果就是 `dist/assets/js/thesvg-icons-*.js` ≈ 1.2MB（167 个图标的
// 全部 variants 都打进了 main bundle 的 vendor 分包）。
//
// 本插件在 Vite 的 load 阶段读取 `@thesvg/react/dist/{slug}.js`，用花括号计数
// 解析出 `_variants` 对象，**只保留 `mono` 一份**（缺 `mono` 时回退到 first
// available variant），然后用「清空过的 _variants + 原 identifier」再写出，
// 让 Vite 把这个瘦身后的版本灌给 Rollup。
//
// 收益（粗估）：
//   · 单个图标：去掉 4-5 个 variants → 单图 ~7KB → ~1.5KB（-70%）。
//   · 167 个图标打包后：~1.18MB → ~360KB（-69%）。
// ============================================================================

const THESVG_PREFIX = `${path.resolve(__dirname, "node_modules/@thesvg/react/dist")}`;

function stripThesvgVariantsPlugin() {
  return {
    name: "strip-thesvg-variants",
    enforce: "pre" as const,
    // 兜底：id 里如果文件分隔符被打平或带了 URL 前缀（Vite 不同模式不太一样），
    // 也照样识别 `@thesvg/react/dist/*.js`。靠 this.load 也行，但生产构建时
    // node_modules 的资源实际是 Rollup 在 resolve 完后再读盘的，干脆给一个
    // resolveId 兜住，再用 load 提供被剥离后的代码。
    resolveId(source: string, importer: string | undefined) {
      if (
        typeof source === "string" &&
        source.includes("@thesvg/react/dist/") &&
        source.endsWith(".js")
      ) {
        // 把 source 解析成绝对路径，强制 vite/rollup 不走预打包 / 缓存。
        const abs = path.isAbsolute(source)
          ? source
          : path.resolve(
              importer ? path.dirname(importer) : __dirname,
              source,
            );
        return { id: abs };
      }
      return null;
    },
    load(id: string) {
      // 只拦 `node_modules/@thesvg/react/dist/{slug}.js`
      //   · id 可能是绝对盘符路径，也可能是带了 `?` query，我们关心路径本体。
      //   · 不动 `package.json` / `index.js` 等元数据文件
      const cleanId = id.split("?")[0];
      // Windows 上 path.resolve 会归一成 '\\'，但 `@thesvg/react/dist` 还
      // 是 `/`，这里用双判定兜底。
      const needle = `${path.sep}@thesvg${path.sep}react${path.sep}dist${path.sep}`;
      if (
        !(
          (cleanId.includes(needle) ||
            cleanId.includes("/@thesvg/react/dist/")) &&
          cleanId.endsWith(".js")
        )
      ) {
        return null;
      }

      const fileName = cleanId
        .split(/[\\/]/)
        .pop()!;
      const slug = fileName.slice(0, -3); // 去 .js
      if (slug === "index") return null;

      let code: string;
      try {
        code = fs.readFileSync(cleanId, "utf-8");
      } catch {
        // 说明 resolveId 没把 source 转成绝对路径，按 source 原样再读一次
        try {
          code = fs.readFileSync(cleanId, "utf-8");
        } catch {
          return null;
        }
      }

      const variants = parseVariants(code);
      if (!variants) return null;

      // 优先 default → mono → 第一个有的 variant
      // （业务侧统一用官方彩版 default，见 model-brand-icon.tsx）
      const picked =
        variants.default ||
        variants.mono ||
        variants.light ||
        variants.color ||
        variants.dark ||
        Object.values(variants)[0];
      if (!picked) return null;

      // 白色根 fill 改成 currentColor：部分厂商（Qwen / Anthropic 等）的 default
      // variant 根 `<svg fill="#ffff">` 是为深色背景准备的官方彩版，直接放浅色
      // 主题会隐形。把白色根 fill 替换成 currentColor，让这类图标跟随主题文字色
      // 可见；真正彩色的硬编码 fill（如 Claude #D97757 / MiniMax #E73562 / Gemini
      // 多色 path）原样保留，这才是「官方彩版」的本意。
      const WHITES = new Set(["#fff", "#ffff", "#ffffff", "#ffffff00", "white", "#FFF", "#FFFF", "#FFFFFF", "White"]);
      const normalized = JSON.parse(JSON.stringify(picked));
      if (typeof normalized === "object" && normalized && WHITES.has(String(normalized.fill))) {
        normalized.fill = "currentColor";
      }

      const slimmed = { default: normalized };
      const identifier = findExportIdentifier(code, slug);
      if (!identifier) return null;

      // 还原成「清空过的 _variants + 原 identifier」模板，复刻 @thesvg/react
      // 源码的对外形状：default export = forwardRef 组件。
      return [
        `import { forwardRef, createElement } from 'react';`,
        `const _variants = ${JSON.stringify(slimmed)};`,
        `const ${identifier} = forwardRef(function ${identifier}({ variant = 'default', viewBox, ...props }, ref) {`,
        `  const _v = _variants[variant] || _variants.default;`,
        `  return createElement(`,
        `    'svg',`,
        `    Object.assign({ ref, viewBox: viewBox || _v.viewBox, fill: _v.fill, stroke: _v.stroke, xmlns: 'http://www.w3.org/2000/svg' }, props),`,
        `    ..._v.childNodes.map(function _c(el) {`,
        `      if (typeof el === 'string') return el;`,
        `      return createElement(el.type, el.props, ...(el.children || []).map(_c));`,
        `    })`,
        `  );`,
        `});`,
        `${identifier}.displayName = '${identifier}';`,
        `export default ${identifier};`,
        ``,
      ].join("\n");
    },
  };
}

/**
 * 用花括号计数 + 引号转义扫描的方式从源码里抠出 `const _variants = {...};`。
 * 比正则更可靠，能正确处理嵌套对象、转义引号等所有 @thesvg/react 用到的情形。
 */
function parseVariants(code: string): Record<string, unknown> | null {
  const marker = "const _variants = ";
  const start = code.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  // 跳过前置空白
  while (i < code.length && /\s/.test(code[i])) i++;
  if (code[i] !== "{") return null;

  let depth = 0;
  let inStr = false;
  let escape = false;
  const startBrace = i;
  for (; i < code.length; i++) {
    const ch = code[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inStr) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        // 闭合
        const jsonStr = code.substring(startBrace, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * 从源码里抠出 `export default <Identifier>;` 的标识符，作为新组件的内部名。
 * @thesvg/react 给所有图标都用一致的命名（digit 起头加 I 前缀）。
 */
function findExportIdentifier(code: string, _slug: string): string | null {
  const m = code.match(/export default\s+([A-Za-z_$][\w$]*)\s*;?/);
  return m ? m[1] : null;
}

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
    // ─── strip-thesvg-variants ────────────────────────────────────────────
    // 在打包阶段把 `@thesvg/react/dist/{slug}.js` 加载的「每个图标含 4-6 个
    // variants (default / mono / light / dark / color / wordmark...)」压成只
    // 留 `mono` 一份（含 `default` 兜底）。
    //
    //   · 不动 React wrapper / API
    //   · 把 _variants 里多余的 variant 整段抹掉，避免 1.2MB+ 的 SVG path data
    //     把 main bundle / thesvg-icons chunk 撑爆
    //
    // 仅当 `import.meta.glob` 试图按目录扫整个库时才会真用到这些 variant。
    // `mcp-icon-lookup.tsx` 只用 `variant="mono"`，多余的全是死字节。
    stripThesvgVariantsPlugin(),
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
        // 代码分割策略：
        //   · 已知名依赖 → 显式 vendor chunk；
        //   · `@thesvg/react` 整库 → 拆到一个独立的 `thesvg-icons` chunk，避免
        //     Rollup 把库里 6,400+ 个图标组件分别切成零碎的小文件（每个 ~5-30KB →
        //     51MB dist）。`mcp-icon-lookup.tsx` 现在只 import 白名单里的图标，
        //     tree-shake 后这个 chunk 只会包含用到的那些。
        manualChunks(id) {
          if (id.includes('node_modules/@thesvg/react/')) {
            return 'thesvg-icons';
          }
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (
            id.includes('node_modules/@radix-ui/react-dialog/') ||
            id.includes('node_modules/@radix-ui/react-dropdown-menu/') ||
            id.includes('node_modules/@radix-ui/react-select/') ||
            id.includes('node_modules/@radix-ui/react-tabs/')
          ) {
            return 'ui-vendor';
          }
          if (id.includes('node_modules/recharts/')) {
            return 'chart-vendor';
          }
          if (id.includes('node_modules/@tanstack/react-virtual/')) {
            return 'virtual';
          }
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
