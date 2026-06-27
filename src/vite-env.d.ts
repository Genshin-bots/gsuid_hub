/// <reference types="vite/client" />

declare const PACKAGE_VERSION: string;

interface ImportMetaEnv {
  /**
   * Demo（免登录 + Mock 数据）构建开关。仅 `--mode demo` 下为 `true`，
   * 由 vite.config.ts 的 `define` 在编译期注入；普通构建为 `undefined`。
   * 用于把演示控制台烤进 GenshinUID-docs 主页内嵌 iframe。
   */
  readonly VITE_DEMO?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
