import { Suspense, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageSpinner } from '@/components/layout/PageSpinner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveApiAssetUrl } from '@/lib/api';
import { AppSidebar } from './AppSidebar';
import { MobileTabBar } from './MobileTabBar';

function LayoutContent() {
  const { style, backgroundImage, blurIntensity, backgroundBlur } = useTheme();

  const isGradient = backgroundImage?.startsWith('linear-gradient');
  const isImage = backgroundImage && !isGradient;
  const isGlassmorphism = style === 'glassmorphism';
  const isLuminous = style === 'luminous';
  const isLiquid = style === 'liquid';
  // 光感/液态默认壁纸用静态 filter 模糊，不再铺整屏 backdrop-filter。
  // 整屏 backdrop 会垫在每张卡下面，侧栏一改宽度就整屏重采样。
  const frostBlur =
    (isLuminous || isLiquid) && !backgroundImage && blurIntensity > 0 ? blurIntensity : 0;

  // 合并背景层为单一元素，减少DOM层级和重绘
  const getBackgroundStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      inset: 0,
      zIndex: -10,
    };

    if (isLiquid) {
      if (isGradient) {
        return { ...baseStyle, background: backgroundImage };
      }
      if (isImage) {
        return {
          ...baseStyle,
          backgroundImage: `url("${resolveApiAssetUrl(backgroundImage)}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        };
      }
      // 苹果液态玻璃默认背景：三原色散流体透镜光斑 (Cyan/Magenta/Amber) 与高通透底色
      return {
        ...baseStyle,
        background: `radial-gradient(ellipse 65% 55% at 18% 12%, hsl(var(--primary) / 0.22) 0%, transparent 60%), radial-gradient(ellipse 55% 45% at 85% 20%, rgba(0, 210, 255, 0.16) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 78% 82%, rgba(255, 60, 160, 0.14) 0%, transparent 60%), radial-gradient(circle 35% at 30% 75%, rgba(255, 190, 70, 0.10) 0%, transparent 50%), hsl(var(--background))`,
      };
    }

    if (isLuminous) {
      if (isGradient) {
        return { ...baseStyle, background: backgroundImage };
      }
      if (isImage) {
        return {
          ...baseStyle,
          backgroundImage: `url("${resolveApiAssetUrl(backgroundImage)}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        };
      }
      // 光感玻璃默认背景：有机流体折射光斑，提供丰富的光学折射源
      return {
        ...baseStyle,
        background: `radial-gradient(ellipse at 12% 15%, hsl(var(--primary) / 0.16) 0%, transparent 55%), radial-gradient(ellipse at 88% 85%, hsl(var(--accent) / 0.14) 0%, transparent 50%), radial-gradient(circle at 50% 45%, hsl(var(--chart-2) / 0.08) 0%, transparent 65%), hsl(var(--background))`,
      };
    }

    if (isGlassmorphism) {
      if (isGradient) {
        return { ...baseStyle, background: backgroundImage };
      }
      if (isImage) {
        return {
          ...baseStyle,
          backgroundImage: `url("${resolveApiAssetUrl(backgroundImage)}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        };
      }
      // 默认毛玻璃渐变 - 使用更简单的渐变减少GPU计算
      return {
        ...baseStyle,
        background: `linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--background)) 100%)`,
      };
    }

    // Solid 模式 - 纯色背景，无渐变计算
    if (isImage) {
      return {
        ...baseStyle,
        backgroundImage: `url("${resolveApiAssetUrl(backgroundImage)}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      };
    }
    return {
      ...baseStyle,
      // Solid模式下使用纯色背景，避免渐变计算
      background: 'hsl(var(--background))',
    };
  };

  // 仅普通毛玻璃保留整屏 backdrop。光感/液态的表面自己会糊，再垫一层会嵌套重采样。
  const overlayStyle = useMemo<React.CSSProperties | null>(() => {
    if (!isGlassmorphism || backgroundImage) return null;
    return {
      position: 'fixed',
      inset: 0,
      zIndex: -9,
      pointerEvents: 'none',
      backdropFilter: `blur(${blurIntensity}px)`,
      WebkitBackdropFilter: `blur(${blurIntensity}px)`,
    };
  }, [isGlassmorphism, backgroundImage, blurIntensity]);

  return (
    <>
      {/* 壁纸。光感/液态的模糊画在这层静态 filter 上，结果可被缓存。 */}
      <div className="pointer-events-none fixed inset-0 z-[-10] overflow-hidden" aria-hidden="true">
        <div
          style={{
            ...getBackgroundStyle(),
            position: 'absolute',
            zIndex: 0,
            filter: `blur(calc(var(--background-blur, ${backgroundBlur}px) + ${frostBlur}px))`,
            transform: 'scale(1.08)',
            transition: 'filter 0.15s ease-out',
          }}
        />
      </div>

      {/* 毛玻璃模式下的额外叠加层（仅毛玻璃模式且无背景图时需要） */}
      {overlayStyle && <div style={overlayStyle} aria-hidden="true" />}

      {/*
        LAYOUT STRUCTURE:
        - AppSidebar comes first (provides spacer)
        - SidebarInset takes remaining space using flex-1
        - SidebarProvider already provides the flex container
      */}
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        {/*
          滚动容器与内边距拆开：
          - main 只负责 overflow，避免 padding+overflow 把卡片阴影竖直裁切
          - .layout-page-inner：标题页用 page-top 呼吸距；左右下为 gutter
          - .page-fill（ai-history 等）：上下与悬浮侧栏对齐，标题页不要加
        */}
        <main className="flex-1 min-h-0 flex flex-col overflow-auto">
          <div className="layout-page-inner">
            <Suspense fallback={<PageSpinner />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <MobileTabBar />
      </SidebarInset>
    </>
  );
}

export function AppLayout() {
  const { sidebarDefaultCollapsed } = useTheme();
  const location = useLocation();
  const isPluginView = location.pathname.startsWith('/plugin-view');
  // 受控 open：主题「默认收起」偏好驱动初始态；用户手动折叠/展开走 onOpenChange
  const [open, setOpen] = useState(() => !sidebarDefaultCollapsed);

  useEffect(() => {
    setOpen(!sidebarDefaultCollapsed);
  }, [sidebarDefaultCollapsed]);

  useEffect(() => {
    if (isPluginView) {
      setOpen(false);
    }
  }, [isPluginView]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen} className="h-dvh overflow-hidden">
      <LayoutContent />
    </SidebarProvider>
  );
}
