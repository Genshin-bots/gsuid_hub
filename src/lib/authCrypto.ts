/**
 * Frontend counterpart of `gsuid_core/webconsole/auth_crypto.py`.
 *
 * 协议：每次认证做一次 X25519 ECDH 握手，派生 32 字节对称密钥，
 *       用 AES-256-GCM 加密明文载荷（其中必带 `ts` 时间戳）。
 *
 * 关键常量必须与后端 `auth_crypto.py` 逐字一致：
 *   - 曲线：          X25519
 *   - HKDF hash:      SHA-256
 *   - HKDF salt:      空
 *   - HKDF info:      "gsuid-webconsole-auth/v1"
 *   - 派生密钥长度:   32 字节 (AES-256)
 *   - 对称加密:       AES-256-GCM
 *   - IV:             随机 12 字节
 *   - AAD:            空
 *   - 时间戳容忍:     120 秒（仅服务端校验）
 *   - 公钥编码:       base64 urlsafe 无 padding, 32 字节
 *
 * 注意：必须用纯 JS 实现（@noble/*），不能用 `window.crypto.subtle`，
 *       否则在 `http://<局域网IP>:<port>/` 这种非安全上下文中
 *       `crypto.subtle` 为 `undefined`。
 */
import { x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes, utf8ToBytes } from '@noble/ciphers/utils.js';

// ===================
// Constants
// ===================

/** HKDF info，握手协议标识，前后端必须完全一致。 */
const PROTOCOL_ID = utf8ToBytes('gsuid-webconsole-auth/v1');

/** 派生的对称密钥长度（AES-256 = 32 字节）。 */
const DERIVED_KEY_LENGTH = 32;

/** GCM IV / nonce 长度。 */
const IV_LENGTH = 12;

// ===================
// Base64 (urlsafe, no padding)
// ===================

/**
 * base64 urlsafe 编码（无 padding）。
 * 不使用 `btoa` / `atob`，避免 UTF-8 兼容性问题与全局函数依赖。
 */
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (i + 1 < len) out += B64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)];
    if (i + 2 < len) out += B64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/**
 * base64 urlsafe 解码（容忍标准 `+/` 变体与 `=` padding）。
 */
export function base64UrlToBytes(b64: string): Uint8Array {
  // 替换 url-safe 变体为标准变体
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  // 补齐 padding
  while (s.length % 4 !== 0) s += '=';
  const lookup = new Int8Array(256).fill(-1);
  for (let i = 0; i < B64_ALPHABET.length; i++) {
    lookup[B64_ALPHABET.charCodeAt(i)] = i;
    // 也接受 + 和 /
    if (B64_ALPHABET[i] === '-') lookup['-'.charCodeAt(0)] = i;
    if (B64_ALPHABET[i] === '_') lookup['_'.charCodeAt(0)] = i;
  }
  lookup['+'.charCodeAt(0)] = 62;
  lookup['/'.charCodeAt(0)] = 63;
  lookup['='.charCodeAt(0)] = 0;

  const cleaned = s.replace(/=+$/, '');
  const outLen = (cleaned.length * 3) >> 2;
  const out = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const c0 = lookup[cleaned.charCodeAt(i)];
    const c1 = lookup[cleaned.charCodeAt(i + 1)];
    const c2 = i + 2 < cleaned.length ? lookup[cleaned.charCodeAt(i + 2)] : 0;
    const c3 = i + 3 < cleaned.length ? lookup[cleaned.charCodeAt(i + 3)] : 0;
    if (p < outLen) out[p++] = (c0 << 2) | (c1 >> 4);
    if (p < outLen) out[p++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (p < outLen) out[p++] = ((c2 & 0x03) << 6) | c3;
  }
  return out;
}

// ===================
// Types
// ===================

export interface ServerPubkey {
  key_id: string;
  alg: string;
  pubkey: string;
  fingerprint: string;
}

export interface EncryptedPayload {
  enc: true;
  key_id: string;
  client_pub: string;
  iv: string;
  ct: string;
}

// ===================
// Pubkey cache
// ===================

interface CachedPubkey {
  data: ServerPubkey;
  serverPubRaw: Uint8Array;
  fetchedAt: number;
}

const PUBKEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
let pubkeyCache: CachedPubkey | null = null;

/** 测试或运维时主动清空缓存（例如检测到解密失败时）。 */
export function clearAuthPubkeyCache(): void {
  pubkeyCache = null;
}

// ===================
// API surface
// ===================

/**
 * GET /api/auth/pubkey 取服务端 X25519 公钥。
 * 5 分钟内复用缓存；缓存缺失或过期则重新拉取。
 */
export async function fetchAuthPubkey(
  baseUrl: string,
  forceRefresh: boolean = false
): Promise<{ key: CachedPubkey }> {
  const now = Date.now();
  if (
    !forceRefresh &&
    pubkeyCache &&
    now - pubkeyCache.fetchedAt < PUBKEY_CACHE_TTL_MS
  ) {
    return { key: pubkeyCache };
  }

  const url = `${baseUrl}/api/auth/pubkey`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch auth pubkey: HTTP ${res.status} ${res.statusText}`
    );
  }

  const json = await res.json();
  if (!json || json.status !== 0 || !json.data) {
    throw new Error(
      `Invalid pubkey response: ${json?.msg ?? 'unknown error'}`
    );
  }
  const data = json.data as ServerPubkey;
  if (data.alg !== 'x25519-aes256gcm') {
    throw new Error(`Unsupported auth alg: ${data.alg}`);
  }

  let serverPubRaw: Uint8Array;
  try {
    serverPubRaw = base64UrlToBytes(data.pubkey);
  } catch (e) {
    throw new Error(`Failed to decode server pubkey: ${(e as Error).message}`);
  }
  if (serverPubRaw.length !== 32) {
    throw new Error(
      `Invalid server pubkey length: ${serverPubRaw.length} (expected 32)`
    );
  }

  pubkeyCache = { data, serverPubRaw, fetchedAt: now };
  return { key: pubkeyCache };
}

/**
 * 用服务端公钥加密业务明文，生成加密报文。
 * 每次都生成全新的临时 X25519 keypair，确保前向保密。
 *
 * @param payload 任意可 JSON 序列化的业务字段。函数内部会自动追加 `ts` 字段。
 * @param cachedKey fetchAuthPubkey 返回的缓存条目。
 */
export function encryptAuthPayload<T extends Record<string, unknown>>(
  payload: T,
  cachedKey: CachedPubkey
): EncryptedPayload {
  // 1. 生成临时 X25519 密钥对（用完即丢）
  const clientPriv = x25519.utils.randomSecretKey();
  let clientPub: Uint8Array;
  let shared: Uint8Array;
  let derivedKey: Uint8Array;
  let iv: Uint8Array;
  let ctWithTag: Uint8Array;
  try {
    clientPub = x25519.getPublicKey(clientPriv);

    // 2. ECDH -> 32 字节共享密钥
    shared = x25519.getSharedSecret(clientPriv, cachedKey.serverPubRaw);

    // 3. HKDF-SHA256(shared, salt=空, info=PROTOCOL_ID) -> 32 字节
    derivedKey = hkdf(
      sha256,
      shared,
      new Uint8Array(0),
      PROTOCOL_ID,
      DERIVED_KEY_LENGTH
    );

    // 4. 随机 12 字节 IV
    iv = randomBytes(IV_LENGTH);

    // 5. 序列化载荷：原字段 + ts
    const fullPayload = {
      ...payload,
      ts: Math.floor(Date.now() / 1000),
    };
    const plaintext = utf8ToBytes(JSON.stringify(fullPayload));

    // 6. AES-256-GCM 加密（AAD = 空）
    const cipher = gcm(derivedKey, iv);
    ctWithTag = cipher.encrypt(plaintext);

    return {
      enc: true,
      key_id: cachedKey.data.key_id,
      client_pub: bytesToBase64Url(clientPub),
      iv: bytesToBase64Url(iv),
      ct: bytesToBase64Url(ctWithTag),
    };
  } finally {
    // 7. 清理临时密钥材料
    if (shared) zeroize(shared);
    if (derivedKey) zeroize(derivedKey);
  }
}

/**
 * 探测后端是否支持加密认证：
 *  - 成功拉到 /api/auth/pubkey 且 alg = x25519-aes256gcm  -> true
 *  - 任何错误（404 / 旧版后端 / 网络） -> false
 *
 * 建议在 Login 页面 mount 时调用一次，根据结果决定是
 * "全程走加密" 还是 "全程走明文"。
 */
export async function probeAuthEncryption(baseUrl: string): Promise<boolean> {
  try {
    const { key } = await fetchAuthPubkey(baseUrl, true);
    return key.data.alg === 'x25519-aes256gcm';
  } catch {
    return false;
  }
}

// ===================
// Helpers
// ===================

function zeroize(arr: Uint8Array): void {
  for (let i = 0; i < arr.length; i++) arr[i] = 0;
}
