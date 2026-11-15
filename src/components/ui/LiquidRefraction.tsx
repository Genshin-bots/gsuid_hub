import { useEffect, useRef } from 'react';
import { useThemeStyle } from '@/contexts/ThemeContext';
import { bezelFor, buildRefractionMap } from '@/lib/liquidRefraction';

interface UABrand {
  brand: string;
  version: string;
}
interface NavigatorUAData {
  brands?: UABrand[];
}

/* Chromium-only：SVG url() 折射只有 Blink 吃，Safari/Firefox 走 CSS 色散边近似。 */
function detectChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData
    ?.brands;
  if (brands) {
    return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|HeadlessChrome/.test(b.brand));
  }
  const ua = navigator.userAgent;
  return /Chrome\/|Edg\/|HeadlessChrome/.test(ua) && !/Firefox\/|CriOS|EdgiOS|FxiOS/.test(ua);
}

/* 大表面：一块玻璃只折射一次（祖先已是玻璃/弹层时跳过）；.glass-card-flat 用于长列表与内嵌容器，不挂折射 */
const GLASS_SELECTOR =
  '.glass-card, .floating-sidebar, .glass-sidebar, .tab-segment-row, .glass-float, .searchable-menu-panel';
const ANCESTOR_GLASS_SELECTOR = `${GLASS_SELECTOR}, .glass-card-flat, [role="dialog"], [role="alertdialog"]`;
/* 仅页头等独立玻璃按钮：位于卡片/侧栏内部的按钮不再二次重采样 */
const BUTTON_SELECTOR =
  'button.bg-primary:not(.button-solid):not([role="tab"]):not([data-sidebar="menu-button"]):not(.tab-segment-row *):not(.select-tile), :is(button, a, .header-outline-control)[class~="bg-background"]:not([role="combobox"], .ui-field-trigger, .ui-input, .ui-select-trigger):not([data-sidebar="menu-button"]):not(.tab-segment-row *):not(.select-tile)';
const TARGET_SELECTOR = `${GLASS_SELECTOR}, ${BUTTON_SELECTOR}`;
/* 视口内折射目标上限：配合 IntersectionObserver 剔除离屏卡片，控制在低 GPU 负载 */
const MAX_TARGETS = 20;
const MIN_W = 36;
const MIN_H = 24;
const MAX_SIZE = 4096;
const REGEN_DEBOUNCE_MS = 160;
/* 滤镜区生长余量：尺寸动画期间保留旧滤镜，放大后的新增区域位移图为中性，
   160ms 防抖后才重建——绝不逐帧摘挂滤镜（P-38） */
const PAD_W = 256;
const PAD_H = 64;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

interface FilterEntry {
  id: string;
  refs: number;
}

function parseRadiusPx(css: string, cap: number): number {
  const raw = css.trim();
  const r = raw.endsWith('%') ? (Number.parseFloat(raw) / 100) * cap : Number.parseFloat(raw) || 0;
  return Math.min(r, cap);
}

/** 生成单通道折射滤镜 DOM：1 张位移图 + 1 次 feDisplacementMap（边缘色散由 CSS ::after --lg-fringe 承担） */
function buildFilterEl(doc: Document, id: string, w: number, h: number, radius: number) {
  const bezel = bezelFor(w, h);
  const map = buildRefractionMap({ width: w, height: h, radius, bezel });
  const padW = w + PAD_W;
  const padH = h + PAD_H;

  // 画布按位移图采样率同比例扩到余量区并垫中性 128（零位移），元素长大不会切到滤镜区外
  const res = map.width / w;
  const canvas = doc.createElement('canvas');
  canvas.width = map.width + Math.round(PAD_W * res);
  canvas.height = map.height + Math.round(PAD_H * res);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(new ImageData(map.data, map.width, map.height), 0, 0);
  const dataUrl = canvas.toDataURL();

  const filter = doc.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', String(padW));
  filter.setAttribute('height', String(padH));
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const feImage = doc.createElementNS(SVG_NS, 'feImage');
  feImage.setAttribute('x', '0');
  feImage.setAttribute('y', '0');
  feImage.setAttribute('width', String(padW));
  feImage.setAttribute('height', String(padH));
  feImage.setAttribute('preserveAspectRatio', 'none');
  feImage.setAttribute('href', dataUrl);
  feImage.setAttributeNS(XLINK_NS, 'xlink:href', dataUrl);
  feImage.setAttribute('result', 'map');
  filter.appendChild(feImage);

  const disp = doc.createElementNS(SVG_NS, 'feDisplacementMap');
  disp.setAttribute('in', 'SourceGraphic');
  disp.setAttribute('in2', 'map');
  disp.setAttribute('xChannelSelector', 'R');
  disp.setAttribute('yChannelSelector', 'G');
  disp.setAttribute('scale', map.scale.toFixed(1));
  filter.appendChild(disp);

  return filter;
}

export function LiquidRefraction() {
  const { style, liquidRefraction } = useThemeStyle();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const active = style === 'liquid' && liquidRefraction && detectChromium();

  useEffect(() => {
    if (!active) {
      return;
    }
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    document.documentElement.dataset.lgRefraction = 'on';

    const cache = new Map<string, FilterEntry>();
    /* 候选表 = 所有非嵌套匹配（含离屏/隐藏/过小）：全部挂 RO 与 IO，
       进入视口或出盒时按需挂载，离屏后释放额度与滤镜 */
    interface ElState {
      sizeKey: string | null;
      acquired: boolean;
      visible: boolean;
      timer: number | null;
    }
    const elements = new Map<HTMLElement, ElState>();
    let rafPending = false;
    let disposed = false;

    const acquire = (key: string, w: number, h: number, radius: number): string | null => {
      const entry = cache.get(key);
      if (entry) {
        entry.refs += 1;
        return entry.id;
      }
      const id = `lg-refract-${key.replace(/\./g, 'p')}`;
      const filter = buildFilterEl(document, id, w, h, radius);
      // canvas 不可用时别留悬空 url(#id)：未解析的 url() 会让整条 backdrop-filter 失效
      if (!filter) {
        return null;
      }
      svg.appendChild(filter);
      cache.set(key, { id, refs: 1 });
      return id;
    };

    const release = (key: string) => {
      const entry = cache.get(key);
      if (!entry) {
        return;
      }
      entry.refs -= 1;
      if (entry.refs <= 0) {
        svg.querySelector(`#${entry.id}`)?.remove();
        cache.delete(key);
      }
    };

    const readDims = (el: HTMLElement) => {
      const w = Math.min(MAX_SIZE, el.clientWidth);
      const h = Math.min(MAX_SIZE, el.clientHeight);
      if (w < MIN_W || h < MIN_H) {
        return null;
      }
      const r = parseRadiusPx(getComputedStyle(el).borderTopLeftRadius, Math.min(w, h) / 2);
      // 精确尺寸作 key：滤镜区按构建时像素建，共享给尺寸不同的元素会在右/下切出空条
      return { w, h, r, key: `${Math.round(w)}x${Math.round(h)}r${Math.round(r)}` };
    };

    const isSkipped = (el: Element): boolean => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.matches(ANCESTOR_GLASS_SELECTOR)) {
          return true;
        }
      }
      return false;
    };

    const releaseFilter = (el: HTMLElement, cur: ElState) => {
      if (cur.acquired && cur.sizeKey) {
        release(cur.sizeKey);
        cur.acquired = false;
        el.style.removeProperty('--lg-refract');
      }
      cur.sizeKey = null;
    };

    const unwire = (el: HTMLElement) => {
      const cur = elements.get(el);
      if (!cur) {
        return;
      }
      if (cur.timer != null) {
        window.clearTimeout(cur.timer);
      }
      releaseFilter(el, cur);
      elements.delete(el);
      ro.unobserve(el);
      io.unobserve(el);
    };

    const acquiredCount = () => {
      let n = 0;
      for (const s of elements.values()) {
        if (s.acquired) {
          n += 1;
        }
      }
      return n;
    };

    const tryApply = (el: HTMLElement) => {
      const cur = elements.get(el);
      if (!cur || !el.isConnected) {
        return;
      }
      if (!cur.visible) {
        releaseFilter(el, cur);
        return;
      }
      const dims = readDims(el);
      if (!dims) {
        releaseFilter(el, cur);
        return;
      }
      if (dims.key === cur.sizeKey) {
        return;
      }
      releaseFilter(el, cur);
      if (acquiredCount() >= MAX_TARGETS) {
        return;
      }
      const id = acquire(dims.key, dims.w, dims.h, dims.r);
      if (!id) {
        return;
      }
      cur.sizeKey = dims.key;
      cur.acquired = true;
      el.style.setProperty('--lg-refract', `url(#${id})`);
    };

    const scan = () => {
      const found = [...document.querySelectorAll<HTMLElement>(TARGET_SELECTOR)].filter(
        (el) => !isSkipped(el),
      );
      const foundSet = new Set(found);
      for (const el of [...elements.keys()]) {
        if (!foundSet.has(el)) {
          unwire(el);
        }
      }
      for (const el of found) {
        if (!elements.has(el)) {
          elements.set(el, { sizeKey: null, acquired: false, visible: false, timer: null });
          ro.observe(el);
          io.observe(el);
        } else {
          tryApply(el);
        }
      }
    };

    const isRelevantNode = (node: Node): boolean =>
      node instanceof Element &&
      ((node.matches(TARGET_SELECTOR) && !isSkipped(node)) ||
        node.querySelector(TARGET_SELECTOR) !== null);

    const hasRelevantMutation = (records: MutationRecord[]): boolean => {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const node of record.addedNodes) {
            if (isRelevantNode(node)) return true;
          }
          for (const node of record.removedNodes) {
            if (isRelevantNode(node)) return true;
          }
        } else if (record.type === 'attributes' && isRelevantNode(record.target)) {
          return true;
        }
      }
      return false;
    };

    const mo = new MutationObserver((records) => {
      if (!hasRelevantMutation(records)) {
        return;
      }
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (!disposed) {
            scan();
          }
        });
      }
    });
    // 显隐靠 class/hidden/data-state 变化（tab 切换不增删节点），必须盯属性；
    // 不盯 style——segment thumb 每帧写 style，会把自己刷成热点
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'data-state'],
    });

    const io = new IntersectionObserver(
      (entries) => {
        if (disposed) return;
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const cur = elements.get(el);
          if (!cur) continue;
          cur.visible = entry.isIntersecting;
          tryApply(el);
        }
      },
      { rootMargin: '120px 0px' },
    );

    // 尺寸变化期间保留旧滤镜（拉伸可接受），安静 160ms 后才重建——
    // 侧栏宽度动画逐帧触发 RO，逐帧重建/摘挂滤镜就是 P-38 的卡死与闪烁来源
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const cur = elements.get(el);
        if (!cur?.visible) {
          continue;
        }
        const nextKey = readDims(el)?.key ?? null;
        if (nextKey === cur.sizeKey) {
          continue;
        }
        if (cur.timer != null) {
          window.clearTimeout(cur.timer);
        }
        cur.timer = window.setTimeout(() => {
          cur.timer = null;
          if (!disposed) {
            tryApply(el);
          }
        }, REGEN_DEBOUNCE_MS);
      }
    });

    scan();

    return () => {
      disposed = true;
      mo.disconnect();
      io.disconnect();
      ro.disconnect();
      for (const el of [...elements.keys()]) {
        unwire(el);
      }
      delete document.documentElement.dataset.lgRefraction;
    };
  }, [active]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    />
  );
}
