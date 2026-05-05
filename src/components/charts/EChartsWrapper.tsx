import { useRef, useEffect, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================================================
// 主题色板
// ============================================================================

const CHART_PALETTE = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#22c55e', '#ef4444',
];

function getThemeColors(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return {
    textColor: isDark ? 'hsl(0, 0%, 80%)' : 'hsl(240, 4%, 35%)',
    textColorStrong: isDark ? 'hsl(0, 0%, 95%)' : 'hsl(240, 10%, 4%)',
    axisLineColor: isDark ? 'hsl(240, 4%, 20%)' : 'hsl(240, 6%, 85%)',
    splitLineColor: isDark ? 'hsl(240, 4%, 16%)' : 'hsl(240, 5%, 92%)',
    tooltipBg: isDark ? 'hsl(240, 10%, 10%)' : 'hsl(0, 0%, 100%)',
    tooltipBorder: isDark ? 'hsl(240, 4%, 20%)' : 'hsl(240, 6%, 90%)',
    tooltipTextColor: isDark ? 'hsl(0, 0%, 95%)' : 'hsl(240, 10%, 4%)',
    legendTextColor: isDark ? 'hsl(240, 5%, 70%)' : 'hsl(240, 4%, 35%)',
    areaGradientStart: isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)',
    areaGradientEnd: isDark ? 'rgba(99, 102, 241, 0.02)' : 'rgba(99, 102, 241, 0.01)',
  };
}

// ============================================================================
// 组件 Props
// ============================================================================

interface EChartsWrapperProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  onEvents?: Record<string, (params: any) => void>;
  notMerge?: boolean;
  lazyUpdate?: boolean;
}

// ============================================================================
// 组件
// ============================================================================

export default function EChartsWrapper({
  option,
  height = 300,
  className = '',
  onEvents,
  notMerge = false,
  lazyUpdate = true,
}: EChartsWrapperProps) {
  const chartRef = useRef<ReactECharts>(null);
  const { mode } = useTheme();
  const themeColors = useMemo(() => getThemeColors(mode), [mode]);

  // 合并主题配置到 option
  const mergedOption = useMemo<EChartsOption>(() => {
    const baseOption: EChartsOption = {
      color: CHART_PALETTE,
      backgroundColor: 'transparent',
      textStyle: {
        color: themeColors.textColor,
        fontFamily: 'inherit',
      },
      title: {
        textStyle: {
          color: themeColors.textColorStrong,
          fontFamily: 'inherit',
        },
      },
      legend: {
        textStyle: {
          color: themeColors.legendTextColor,
        },
        pageTextStyle: {
          color: themeColors.legendTextColor,
        },
      },
      tooltip: {
        backgroundColor: themeColors.tooltipBg,
        borderColor: themeColors.tooltipBorder,
        borderWidth: 1,
        textStyle: {
          color: themeColors.tooltipTextColor,
          fontSize: 13,
        },
        extraCssText: 'backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);',
      },
    };

    // 仅当用户 option 包含轴配置时，才注入轴主题样式
    const axisTheme = {
      axisLine: { lineStyle: { color: themeColors.axisLineColor } },
      axisTick: { lineStyle: { color: themeColors.axisLineColor } },
      axisLabel: { color: themeColors.textColor },
      splitLine: { lineStyle: { color: themeColors.splitLineColor, type: 'dashed' } },
    };

    if (option.xAxis) {
      baseOption.xAxis = axisTheme;
    }
    if (option.yAxis) {
      baseOption.yAxis = axisTheme;
    }

    // Deep merge - user option takes precedence
    return deepMerge(baseOption, option) as EChartsOption;
  }, [option, themeColors]);

  // 主题变化时刷新图表
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (instance) {
      instance.resize();
    }
  }, [mode]);

  const getHeight = useCallback(() => {
    return typeof height === 'number' ? `${height}px` : height;
  }, [height]);

  return (
    <div className={className} style={{ width: '100%', height: getHeight() }}>
      <ReactECharts
        ref={chartRef}
        option={mergedOption}
        style={{ width: '100%', height: '100%' }}
        notMerge={notMerge}
        lazyUpdate={lazyUpdate}
        onEvents={onEvents}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}

// ============================================================================
// 工具函数
// ============================================================================

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

// ============================================================================
// 导出工具
// ============================================================================

export { CHART_PALETTE, getThemeColors };
export type { EChartsOption };
