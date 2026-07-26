// ============================================================================
// Live Chat · 媒体双形态（base64:// / link://）与文件编解码
// ============================================================================

/** 把 image/record/video 的 data 转成浏览器可播放/展示的 URL */
export function mediaDataToSrc(data: string, mimeFallback = 'application/octet-stream'): string {
  if (!data) return '';
  if (data.startsWith('link://')) {
    return data.slice('link://'.length);
  }
  if (data.startsWith('base64://')) {
    const b64 = data.slice('base64://'.length);
    // 尽量猜图片 mime；音频/视频调用方应传更准的 mime
    const mime = guessMimeFromBase64Header(b64) || mimeFallback;
    return `data:${mime};base64,${b64}`;
  }
  // 裸 url 或 裸 base64
  if (/^https?:\/\//i.test(data) || data.startsWith('data:')) {
    return data;
  }
  // 当作裸 base64
  if (/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 80))) {
    return `data:${mimeFallback};base64,${data.replace(/\s/g, '')}`;
  }
  return data;
}

function guessMimeFromBase64Header(b64: string): string | null {
  const head = b64.slice(0, 16);
  // 常见 magic 的 base64 前缀
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('iVBOR')) return 'image/png';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  if (head.startsWith('UklGR')) return 'image/webp';
  if (head.startsWith('//uQ') || head.startsWith('SUQz')) return 'audio/mpeg';
  if (head.startsWith('T2dnUw')) return 'audio/ogg';
  if (head.startsWith('AAAA') || head.startsWith('GkXf')) return 'video/mp4';
  return null;
}

/** File → base64:// 载荷（去掉 data:mime;base64, 前缀） */
export async function fileToBase64Payload(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return `base64://${b64}`;
}

/** 解析 file 段：`文件名|内容` */
export function parseFileSegment(data: string): { name: string; content: string } {
  const idx = data.indexOf('|');
  if (idx < 0) return { name: 'file', content: data };
  return { name: data.slice(0, idx) || 'file', content: data.slice(idx + 1) };
}

/** file 内容 → 可下载/预览 src */
export function fileContentToSrc(content: string): string {
  if (content.startsWith('link://')) return content.slice(7);
  if (content.startsWith('base64://')) {
    return `data:application/octet-stream;base64,${content.slice(9)}`;
  }
  if (/^https?:\/\//i.test(content) || content.startsWith('data:')) return content;
  return `data:application/octet-stream;base64,${content}`;
}

/** 读图文件为 base64 并附带 object URL 预览 */
export async function prepareOutgoingImage(file: File): Promise<{ payload: string; previewUrl: string }> {
  const payload = await fileToBase64Payload(file);
  const previewUrl = URL.createObjectURL(file);
  return { payload, previewUrl };
}
