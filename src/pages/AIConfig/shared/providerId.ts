/**
 * 网络搜索 / 网页抓取等多源配置的 provider id 比较。
 * 后端 options 多为 `Jina`/`local`，但大小写漂移时仍应视为同一源，
 * 避免主用禁用、备用剥离、save-time strip 失效。
 */
export function sameProviderId(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** 从备用顺序中剔除与主用同 id 的项（trim + 大小写不敏感）。 */
export function filterOutPrimaryProvider(
  order: readonly string[],
  primary: string,
): string[] {
  return order.filter((p) => p && !sameProviderId(p, primary));
}
