import { Outlet } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function LayoutHeader() {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  if (!isMobile) return null;
  
  return (
    <div className="sticky top-0 z-10 w-full bg-background/80 backdrop-blur-sm border-b border-border/40 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="打开菜单">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/app/ICON.png" alt="GsCore" className="w-6 h-6 object-contain" />
          </div>
          <span className="font-semibold">GsCore</span>
          <span className="font-light text-sm text-muted-foreground">v{import.meta.env.PACKAGE_VERSION || '0.0.4'}</span>
        </div>
      </div>
      <button onClick={() => navigate('/settings')} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
        <Avatar className="w-8 h-8">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          )}
        </Avatar>
      </button>
    </div>
  );
}

function LayoutContent() {
  const { style, backgroundImage, blurIntensity } = useTheme();
  const isMobile = useIsMobile();

  const isGradient = backgroundImage?.startsWith('linear-gradient');
  const isImage = backgroundImage && !isGradient;
  const isGlassmorphism = style === 'glassmorphism';

  // 合并背景层为单一元素，减少DOM层级和重绘
  const getBackgroundStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      inset: 0,
      zIndex: -10,
    };

    if (isGlassmorphism) {
      if (isGradient) {
        return { ...baseStyle, background: backgroundImage };
      }
      if (isImage) {
        return {
          ...baseStyle,
          backgroundImage: `url("${backgroundImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        };
      }
      // 默认毛玻璃渐变
      return {
        ...baseStyle,
        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--background)) 50%, hsl(var(--accent) / 0.1) 100%)',
      };
    }

    // Solid 模式
    if (isImage) {
      return {
        ...baseStyle,
        backgroundImage: `url("${backgroundImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      };
    }
    return {
      ...baseStyle,
      background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--secondary) / 0.3) 100%)',
    };
  };

  return (
    <>
      {/* 合并后的单一背景层 */}
      <div style={getBackgroundStyle()} />

      {/* 毛玻璃模式下的额外叠加层（仅毛玻璃模式需要） */}
      {isGlassmorphism && !backgroundImage && (
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{
            backdropFilter: `blur(${blurIntensity}px)`,
            WebkitBackdropFilter: `blur(${blurIntensity}px)`,
          }}
        />
      )}

      {/*
        LAYOUT STRUCTURE:
        - AppSidebar comes first (provides spacer)
        - SidebarInset takes remaining space using flex-1
        - SidebarProvider already provides the flex container
      */}
      <AppSidebar />
      <SidebarInset
        className={cn(
          "flex flex-col overflow-hidden transition-transform"
        )}
      >
        <LayoutHeader />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      <LayoutContent />
    </SidebarProvider>
  );
}
