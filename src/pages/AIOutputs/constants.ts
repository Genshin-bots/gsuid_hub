/**
 * 产出物 / 工具落盘两个面板共用的常量与纯函数。
 * 单独成文件是有意的：shared.tsx 只放组件，避免 react-refresh 报
 * 「同文件既导出组件又导出常量」。
 */

/** Radix Select 不接受 value=""，用哨兵表示「全部工具」（AGENTS.md §1.6） */
export const TOOL_ALL = '__all__';

/** 字节数按 KB / MB 两级收敛，避免表格里出现 6 位数 */
export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
