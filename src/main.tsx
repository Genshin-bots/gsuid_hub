import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installMockServer } from "./lib/mockServer";
import { setAuthToken } from "./lib/api";

// ─── Demo（演示）模式 ────────────────────────────────────────────────────
// `--mode demo` 下：先安装 Mock Server（覆写 window.fetch 接管所有 /api/*），
// 并写入假 token，再渲染 <App/>。普通构建下 import.meta.env.VITE_DEMO 为 undefined，
// 整个分支与 mockServer 引用被 tree-shake，零影响。
if (import.meta.env.VITE_DEMO) {
  // 演示模式：用「内存版」localStorage 顶替真实 localStorage。
  // 6 个内嵌面板同源（都在 /hub/），原本会共享同一份 localStorage —— 于是在一个面板里改主题，
  // 会被写进 localStorage 并跨刷新残留、还会「串台」影响其它面板。改成内存版后：
  //   · 每次刷新都是干净的初始状态（主题等不持久化，始终由 Mock 的默认配置决定）；
  //   · 每个 iframe 各自独立，互不影响。
  // 必须在 installMockServer / 任何 Context 读取之前安装。仅 demo 生效，对生产零影响。
  try {
    const mem = new Map<string, string>();
    const memStorage = {
      get length() { return mem.size; },
      clear() { mem.clear(); },
      getItem(k: string) { return mem.has(k) ? mem.get(k)! : null; },
      key(i: number) { return Array.from(mem.keys())[i] ?? null; },
      removeItem(k: string) { mem.delete(k); },
      setItem(k: string, v: string) { mem.set(k, String(v)); },
    } as Storage;
    Object.defineProperty(window, "localStorage", { configurable: true, value: memStorage });
  } catch {
    // 退而求其次：至少清掉主题相关键，避免跨刷新残留。
    try {
      ["theme_mode", "theme_style", "theme_color", "theme_bg", "theme_blur",
        "theme_card_opacity", "theme_icon_color", "theme_preset", "theme_language"]
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }

  installMockServer();
  setAuthToken("demo-token");
  // 嵌入锁定模式：docs 主页 iframe 以 `?embed=1` 加载本应用。此时给 <html> 打上 demo-embed 类，
  // 由 index.css 把侧边栏置为「可见但不可点击」，避免访客点侧边栏切走到别的页面（见用户反馈）。
  if (new URLSearchParams(location.search).get("embed") === "1") {
    document.documentElement.classList.add("demo-embed");
  }
}

createRoot(document.getElementById("root")!).render(<App />);
