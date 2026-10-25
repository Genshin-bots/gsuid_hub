/**
 * TabButtonGroup 外壳宽度跟随调用方的宽度类（纯逻辑，单独成文件便于单测）。
 *
 * 背景：`className="w-full sm:w-max"` 的本意是「窄屏铺满、桌面自适应」。
 * 若外壳只判断「有没有 w-full」就会永久通栏，在 flex-wrap 容器里占满整行，
 * 把同行兄弟挤到下一行（/plugins 卡片头的「插件自带页面」按钮就是这么掉到第二行的）。
 */

/** 宽度类：full / max / min / fit / auto / none，可带响应式前缀（sm:、lg: …）。 */
const WIDTH_TOKEN_RE = /^(?:[\w]+:)*w-(?:full|max|min|fit|auto|none)$/;

/** 取出 className 里的宽度类（含响应式前缀），供外壳照抄。 */
export function pickWidthTokens(className: string | undefined): string[] {
  if (!className) return [];
  return className.split(/\s+/).filter((token) => token.length > 0 && WIDTH_TOKEN_RE.test(token));
}

/**
 * 外壳是否要通栏：className 里出现 w-full 或 grid 时通栏。
 * 注意 grid 也会命中 grid-cols-* —— 那是调用方的布局类，同样需要通栏外壳。
 */
export function needsFullWidthWrapper(className: string | undefined): boolean {
  if (!className) return false;
  return /\b(?:w-full|grid)\b/.test(className);
}
