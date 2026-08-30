import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AppWindow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { pluginsApi, type PluginPageMeta } from '@/lib/api';
import {
  buildHubThemeMessage,
  buildPluginPageSrc,
  collectHubThemeVars,
  isHubThemeRequest,
  pickPluginPageText,
  pluginsListPath,
} from '@/lib/pluginPage';

interface PluginViewState {
  from?: string;
  page?: PluginPageMeta;
}

export default function PluginViewPage() {
  const { pluginId = '', pageId = 'main' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { mode, style, iconColor, color } = useTheme();
  const navState = location.state as PluginViewState | null;
  const [page, setPage] = useState<PluginPageMeta | undefined>(navState?.page);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bootTheme = useRef({ mode, style });

  useEffect(() => {
    if (page) return;
    let cancelled = false;
    pluginsApi
      .getPluginList()
      .then((list) => {
        if (cancelled) return;
        const hit = list
          .flatMap((item) => item.pages ?? [])
          .find((item) => item.plugin_id === pluginId && item.id === (pageId || 'main'));
        if (hit) setPage(hit);
      })
      .catch(() => {
        // 旧后端没有 pages 字段时保持标题兜底
      });
    return () => {
      cancelled = true;
    };
  }, [page, pluginId, pageId]);

  const src = useMemo(
    () =>
      buildPluginPageSrc({
        pluginId,
        pageId: pageId || 'main',
        locale: language,
        theme: bootTheme.current.mode,
        style: bootTheme.current.style,
      }),
    [pluginId, pageId, language],
  );

  const postTheme = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      buildHubThemeMessage({
        mode,
        style,
        iconColor,
        color,
        vars: collectHubThemeVars(document.documentElement),
      }),
      '*',
    );
  }, [mode, style, iconColor, color]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => postTheme());
    return () => window.cancelAnimationFrame(id);
  }, [postTheme]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (!isHubThemeRequest(ev.data)) return;
      postTheme();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postTheme]);

  const title = pickPluginPageText(page?.title, language, page?.plugin || pluginId);
  const from = navState?.from || pluginsListPath(pluginId);

  return (
    <div className="page-fill flex flex-col min-h-0 gap-3">
      <div className="flex items-center gap-3 shrink-0 min-w-0">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0 h-9"
          onClick={() => navigate(from)}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('plugins.pluginPageBack')}
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          {page?.plugin ? (
            <PluginIcon pluginName={page.plugin} className="w-6 h-6" />
          ) : (
            <AppWindow className="w-5 h-5 text-primary" />
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            <p className="text-muted-foreground text-xs truncate">
              {pickPluginPageText(page?.description, language, t('plugins.openPluginPageDesc'))}
            </p>
          </div>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        className="flex-1 w-full min-h-0 rounded-lg border border-border bg-background"
        src={src}
        title={title}
        allow="clipboard-read; clipboard-write"
        onLoad={postTheme}
      />
    </div>
  );
}
