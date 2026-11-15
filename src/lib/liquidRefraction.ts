/**
 * 液态玻璃每元素尺寸正确的折射位移图生成器。
 * feDisplacementMap 按 P'(x,y) = P(x + scale·(R/255−0.5), y + scale·(G/255−0.5)) 采样：
 * 位移图里 128 是 0 偏移；这里把 R/G 沿「指向元素内部」的边法线方向偏正，
 * 即采样点向玻璃内部收（凸透镜收边），且不会采到边缘外的透明像素。
 * 纯函数、无 DOM/Canvas 依赖，可在 node 环境跑测试。
 */

export interface RefractionMapSpec {
  /** 元素 padding box 宽（CSS px） */
  width: number;
  /** 元素 padding box 高（CSS px） */
  height: number;
  /** 圆角半径（CSS px，会被钳到 min(w,h)/2） */
  radius: number;
  /** 折射斜面宽度（CSS px，从边缘向内） */
  bezel: number;
}

export interface RefractionMap {
  /** 位移图像素宽（= round(width * resolution)） */
  width: number;
  /** 位移图像素高 */
  height: number;
  /** RGBA 像素数据；B 恒 128，A 恒 255（ArrayBuffer 以便直接喂 ImageData） */
  data: Uint8ClampedArray<ArrayBuffer>;
  /** 边缘光谱层（RGBA 预乘语义，直接 over 到折射结果上）：
   *  真实三通道位移差在模糊/低对比背景下会被抹淡，这层给出稳定的青→红边缘色散 */
  fringe: Uint8ClampedArray<ArrayBuffer>;
  /** 对应 feDisplacementMap 的 scale 属性（CSS px） */
  scale: number;
}

/** 斜面宽度：约短边 25%，夹在 8~28px —— 小控件不至于整个弯，大卡不至于糊边 */
export function bezelFor(width: number, height: number): number {
  return Math.min(28, Math.max(8, Math.min(width, height) * 0.25));
}

/**
 * 圆角矩形 SDF（相对矩形中心，负值在内部）。
 * 与一般写法等价：max(q,0) 的欧氏距离 + min(max(qx,qy),0) − r。
 */
function roundedRectSDF(px: number, py: number, hw: number, hh: number, r: number): number {
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

export interface RefractionMapOptions {
  /** 是否同时生成光谱边带位图；默认 false，色散边由 CSS --lg-fringe 承担以省去第二张 PNG 与合成通道 */
  includeFringe?: boolean;
}

/**
 * resolution = 位移图相对 CSS px 的采样率（0.25 = 每 4 CSS px 一个采样，
 * 斜面呈平滑幂曲线，feImage 拉伸插值几乎无损，像素数降至 1/4）。
 */
export function buildRefractionMap(
  spec: RefractionMapSpec,
  resolution = 0.25,
  options?: RefractionMapOptions,
): RefractionMap {
  const includeFringe = options?.includeFringe ?? false;
  const mw = Math.max(1, Math.round(spec.width * resolution));
  const mh = Math.max(1, Math.round(spec.height * resolution));
  const radius = Math.max(0, Math.min(spec.radius, Math.min(spec.width, spec.height) / 2));
  const bezel = Math.max(1, spec.bezel);
  const data = new Uint8ClampedArray(mw * mh * 4);
  const fringe = includeFringe ? new Uint8ClampedArray(mw * mh * 4) : new Uint8ClampedArray(0);

  const hw = spec.width / 2;
  const hh = spec.height / 2;
  // 数值梯度步长（CSS px）。斜面内 SDF 是 C1 的，有限差分足够稳。
  const eps = 0.5;
  const sdf = (px: number, py: number) => roundedRectSDF(px, py, hw, hh, radius);

  let idx = 0;
  for (let j = 0; j < mh; j++) {
    const cy = (j + 0.5) / resolution - hh;
    for (let i = 0; i < mw; i++) {
      const cx = (i + 0.5) / resolution - hw;
      const d = -sdf(cx, cy); // 向内为正

      if (d >= bezel) {
        // 内部：精确中性 128，跳过法线计算
        data[idx] = 128;
        data[idx + 1] = 128;
      } else {
        const t = 1 - Math.max(0, d) / bezel;
        const m = t ** 1.6; // 凸透镜剖面：边缘最强，整带保持弯折
        const gx = (sdf(cx + eps, cy) - sdf(cx - eps, cy)) / (2 * eps);
        const gy = (sdf(cx, cy + eps) - sdf(cx, cy - eps)) / (2 * eps);
        const len = Math.hypot(gx, gy) || 1;
        data[idx] = 128 + Math.round((-gx / len) * m * 127);
        data[idx + 1] = 128 + Math.round((-gy / len) * m * 127);
        // 光谱边带：仅显式开启时生成
        if (includeFringe && t > 0.72) {
          const fade = Math.min(1, (t - 0.72) / 0.12);
          const mix = Math.min(1, Math.max(0, (t - 0.8) / 0.15)); // 0=青侧 → 1=红侧
          fringe[idx] = 90 + (255 - 90) * mix;
          fringe[idx + 1] = 200 + (105 - 200) * mix;
          fringe[idx + 2] = 255 + (70 - 255) * mix;
          fringe[idx + 3] = Math.round(fade * 0.24 * 255);
        }
      }
      data[idx + 2] = 128;
      data[idx + 3] = 255;
      idx += 4;
    }
  }

  return { width: mw, height: mh, data, fringe, scale: bezel * 1.8 };
}
