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
  installMockServer();
  setAuthToken("demo-token");
  // 嵌入锁定模式：docs 主页 iframe 以 `?embed=1` 加载本应用。此时给 <html> 打上 demo-embed 类，
  // 由 index.css 把侧边栏置为「可见但不可点击」，避免访客点侧边栏切走到别的页面（见用户反馈）。
  if (new URLSearchParams(location.search).get("embed") === "1") {
    document.documentElement.classList.add("demo-embed");
  }
}

createRoot(document.getElementById("root")!).render(<App />);
