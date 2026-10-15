import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeColors } from './EChartsWrapper';

/**
 * 全站图表的视觉基元。与 /dashboard 同源：同一套主题色阶、同样的圆角与轴规则，
 * 换页不换风格。页面自己不要再写死色号，也不要重新实现这里的东西。
 */

// ============================================================================
// 颜色
// ============================================================================

/** '#rrggbb' → 'rgba(...)'，用来铺面积图 / 柱图的纵向渐变 */
export function withAlpha(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 柱体：上浓下淡。收得太淡会让高柱的下半段读不出高度差，底端留 0.72。 */
export function barFill(hex: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: hex },
      { offset: 1, color: withAlpha(hex, 0.72) },
    ],
  };
}

/**
 * 整行大图用的面积渐变。
 *
 * `barFill`（1 → 0.72）是给窄而矮的小倍数面板设计的，那种尺寸下才压得住底噪。
 * 整行趋势图又宽又高，同样的不透明度会糊成一整块色，把上面几条细线全盖掉 ——
 * 大图要的是「线读数、色只做背景」，所以另给一档更淡的。
 */
export function softAreaFill(hex: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: withAlpha(hex, 0.28) },
      { offset: 1, color: withAlpha(hex, 0.02) },
    ],
  };
}

/** HSL → '#rrggbb'。图表色必须是 hex：withAlpha / barFill 只会按 hex 解析透明度。 */
export function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100;
  const L = l / 100;
  const a = S * Math.min(L, 1 - L);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = L - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * 图表配色：从当前主题主色推一组「同色系色阶」，不再给每个系列哈希一种颜色。
 * 6~8 支彩虹色压在玻璃背景上很脏；同色系只靠明度分层，安静，而且切主题自动跟随。
 *
 * 主色由 useTheme().primary 直接给（HSL 三元组，不包 `hsl()`），shadcn 预设等分支也自动生效，
 * 页面里不必复刻一份主题色表。
 *
 * **不要改回去自己 getComputedStyle 读 `--primary`**：ThemeContext 是用
 * `requestAnimationFrame` 异步把变量写进 DOM 的，子组件的 effect 必然跑在它前面，
 * 读到的只有 index.css 里的静态默认值（`333 71% 50%`，玫瑰粉）——
 * 于是主题明明是海蓝，图表却常年粉着，而且依赖不变就不会重算。
 *
 * 只取主色的**色相和饱和度**，明度另给一套固定阶梯 —— 主色本身可能很暗
 * （shadcn 浅色预设的 primary 是 `210 40% 98%`），照搬它的明度会画出一条看不见的线。
 * 第五格是「其他 / 次要」专用中性色，所有堆叠图里的兜底项永远同色。
 */
export function readSeriesRamp(primaryHsl: string, isDark: boolean): string[] {
  const [h, s] = primaryHsl.trim().split(/\s+/);
  const H = Number(h) || 350;
  // 主色饱和度过低（灰白系预设）时兜到 45%，否则四格会糊成同一片灰
  const S = Math.max(Number(s?.replace('%', '')) || 65, 45);
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  return isDark
    ? [
        hslToHex(H, S, 66),
        hslToHex((H + 24) % 360, S * 0.75, 78),
        hslToHex((H + 330) % 360, S * 0.6, 54),
        hslToHex(H, S * 0.9, 42),
        hslToHex(H, 10, 28),
      ]
    : [
        hslToHex(H, S, 56),
        hslToHex((H + 24) % 360, S * 0.75, clamp(70, 50, 78)),
        hslToHex((H + 330) % 360, S * 0.6, 44),
        hslToHex(H, S * 0.9, 33),
        hslToHex(H, 10, 80),
      ];
}

/** 全页图表共用一套主题色阶：切主题时所有图一起换色。纯派生，不需要 effect。 */
export function useSeriesRamp(): string[] {
  const { primary, mode } = useTheme();
  return useMemo(() => readSeriesRamp(primary, mode === 'dark'), [primary, mode]);
}

export interface ChartAxisColors {
  /** 轴标签 / 刻度文字 */
  text: string;
  /** 次要文字（图例、轴名） */
  muted: string;
  /** 网格线 */
  split: string;
}

/**
 * canvas 读不到 CSS 变量，所以轴名 / 图例这类「EChartsWrapper 的合并轴主题管不到」的
 * 位置（多 y 轴、legend、markLine 标签）要显式取色，否则深色模式下会落回 ECharts
 * 默认的深灰。单 y 轴的图不必用，轴主题已经注入过了。
 */
export function useChartAxisColors(): ChartAxisColors {
  const { mode } = useTheme();
  return useMemo(() => {
    const c = getThemeColors(mode);
    return { text: c.textColor, muted: c.legendTextColor, split: c.splitLineColor };
  }, [mode]);
}

// ============================================================================
// 坐标轴底子
// ============================================================================

/**
 * 轴的统一起手式。不画轴线、不画刻度，网格线压到 45% 不透明度 —— 轴线在现代看板里
 * 是噪音，真正的读数靠网格线。调用方补 data / axisLabel。
 */
export const CATEGORY_AXIS_BASE = {
  type: 'category' as const,
  axisLine: { show: false },
  axisTick: { show: false },
};

export const VALUE_AXIS_BASE = {
  type: 'value' as const,
  axisLine: { show: false },
  axisTick: { show: false },
  splitLine: { lineStyle: { type: 'dashed' as const, opacity: 0.45 } },
};

// ============================================================================
// 柱条圆角
// ============================================================================

/**
 * 全站一条规则：**只圆数据伸出去的那一头**。
 * 贴着基线那一头保持直角，柱子才像「从 0 长出来」而不是浮在空中；
 * 两头都圆会和旁边堆叠图的圆角对不上，看着像两套组件。
 */
export const BAR_RADIUS_R = 4;
export const BAR_RADIUS_TOP: [number, number, number, number] = [BAR_RADIUS_R, BAR_RADIUS_R, 0, 0];
export const BAR_RADIUS_RIGHT: [number, number, number, number] = [
  0,
  BAR_RADIUS_R,
  BAR_RADIUS_R,
  0,
];

export type StackedCell = {
  value: number;
  itemStyle?: { borderRadius?: typeof BAR_RADIUS_RIGHT };
};

/**
 * 堆叠条：圆角挂在「这一行最后一个非零分段」上，而不是挂 series 下标。
 * 末尾那个系列对某些行可能是 0，最右侧可见的分段其实是中间的某个 series，
 * 按下标给圆角就会让同一张图里有的条圆、有的条方 —— 看起来像两套组件。
 * 返回 [行][series 下标] 的单元格矩阵，调用方按 series 取整列。
 */
export function stackedCells(rows: number[][]): StackedCell[][] {
  return rows.map((values) => {
    let lastNonZero = -1;
    values.forEach((v, i) => {
      if (v !== 0) lastNonZero = i;
    });
    return values.map((value, i) =>
      i === lastNonZero ? { value, itemStyle: { borderRadius: BAR_RADIUS_RIGHT } } : { value },
    );
  });
}

// ============================================================================
// 图例与刻度
// ============================================================================

/** 图例统一样式：窄块里多项换行会盖住绘图区，尺寸压小 + scroll 翻页 */
export const LEGEND_BASE = {
  icon: 'roundRect' as const,
  itemWidth: 12,
  itemHeight: 8,
  itemGap: 16,
  textStyle: { fontSize: 11 },
};

/**
 * Y 轴刻度压缩成 3.0k / 1.5k / 900 这种宽度。
 * 小倍数面板窄，原样输出「15,000」会被下一个面板的绘图区切掉半个字。
 */
export function compactTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${+(value / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

/**
 * Y 轴上界。ECharts 自带的取整档位是 1/2/5/10，落不到 2600 就会抬到 4000（线只占 65% 高），
 * 落不到 490 就会抬到 1000（线只占一半）—— 同一排格子的线于是忽高忽低，第 4 格还会
 * 因为多出一档 500 的中间刻度、比邻格多印一个数字。补上 1.5/3 两档，上界贴着数据顶。
 * 5~10 之间再补一档 7.5：日均 Token 常年落在 6~8k，没有这一档就会一律抬到 10k，
 * 绘图区白白空掉三成。
 */
export function niceMax(values: number[]): number {
  const max = Math.max(0, ...values);
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  const norm = max / mag;
  const step =
    norm <= 1
      ? 1
      : norm <= 1.5
        ? 1.5
        : norm <= 2
          ? 2
          : norm <= 3
            ? 3
            : norm <= 5
              ? 5
              : norm <= 7.5
                ? 7.5
                : 10;
  return step * mag;
}

/** 单序列横条 / 堆叠条的粗细，固定值。别按行数反向加粗（详见 /dashboard 内的注释）。 */
export const BAR_THICKNESS = 16;
