import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// token 数量的紧凑展示（1234 → 1.23K，1.5M …），AI 历史等页面共用
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(2)}K`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/**
 * 复制文本到剪贴板：优先使用 Clipboard API，
 * 在非安全上下文（如内网 HTTP IP 访问）或权限受限时降级为 execCommand('copy')。
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Clipboard API 可能因权限或聚焦状态失败，继续走 execCommand 降级
    }
  }

  const previousActive =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // 挂载到当前弹层容器内，避免 Radix FocusScope 拦截 textarea 聚焦导致复制失败
  const container =
    previousActive?.closest(
      '[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]',
    ) ?? document.body;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  container.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const success = document.execCommand('copy');
    if (!success) {
      throw new Error('execCommand copy failed');
    }
  } finally {
    container.removeChild(textarea);
    previousActive?.focus({ preventScroll: true });
  }
}
