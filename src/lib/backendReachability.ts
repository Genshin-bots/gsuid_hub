/**
 * 后端可达性判定。
 *
 * 「连不上后端」有两种截然不同的表现形式，必须都认出来，否则登录页会在
 * Core 没启动时照样显示成一个看起来完全正常的表单：
 *
 *  1. **fetch 直接 reject**（生产：前端由 Core 同源挂载，或自定义 Host 跨域时）
 *     抛的是 `TypeError`，各浏览器文案不同（Chrome `Failed to fetch`、
 *     Safari `Load failed`、Firefox `NetworkError when attempting to fetch resource`）。
 *
 *  2. **dev 模式经 Vite 代理**：请求先打到 Vite，再由它转发给 `localhost:8765`。
 *     Core 没启动时 Vite 返回 **`500 text/plain` + 空 body**——这是 Vite 自己
 *     造的响应，后端一个字节都没回。fetch 拿到了正常应答，因此**不会** reject，
 *     只看 `TypeError` 会漏掉这一整类（也就是本地开发最常见的那种）。
 *
 * 2 与「后端真的报 500」靠 body 形态区分：后端的 5xx 一定是 JSON 封套
 * （`{detail}` / `{status,msg}`），Vite 代理的空 body 不是。502/503/504 一律
 * 按网关层失败处理，同样属于不可达。
 */

/** 请求没拿到后端任何有效应答（代理失败 / 网关错误 / fetch reject）。 */
export class BackendUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendUnreachableError';
  }
}

/**
 * 响应是否属于「后端不可达」。
 * 仅看 5xx + body 形态，不含业务封套 —— 后端有应答的 5xx 必须照常回显 msg/detail。
 */
export function isUnreachableResponse(response: {
  status: number;
  bodyIsJson: boolean;
  hasBody: boolean;
}): boolean {
  if (response.status < 500) return false;
  // 后端回了 JSON 封套：业务错误，照常把 msg/detail 抛给 UI
  if (response.bodyIsJson) return false;
  // 网关类状态码（502/503/504）无论 body 形态都算不可达
  if (response.status === 502 || response.status === 503 || response.status === 504) return true;
  // Vite 代理 ECONNREFUSED：500 + 空 body
  return !response.hasBody;
}

/** 判定任意错误是否源于「后端不可达」。 */
export function isBackendUnreachable(source: unknown): boolean {
  if (source instanceof BackendUnreachableError) return true;
  if (source instanceof TypeError) return true;
  const message = source instanceof Error ? source.message : typeof source === 'string' ? source : '';
  // Safari / Firefox 的网络层文案；注意不要匹配 'Failed to fetch auth pubkey'
  // 这类我们自己拼的 HTTP 错误串，它属于后端有应答但状态码不对。
  return /\b(load failed|networkerror|network request failed|err_connection)\b/i.test(message);
}
