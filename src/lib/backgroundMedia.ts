// 动态壁纸识别：按扩展名判定，命中后走 <video> 渲染而非 CSS background-image。
const VIDEO_BG_URL_RE = /\.(mp4|webm|mov|m4v|ogv|ogg)([?#].*)?$/i;

export function isVideoBackgroundUrl(url: string | null | undefined): boolean {
  const v = url?.trim() ?? '';
  return VIDEO_BG_URL_RE.test(v) || v.startsWith('data:video/');
}
