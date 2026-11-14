import { useEffect, useRef } from 'react';
import { resolveApiAssetUrl } from '@/lib/api';
import { isVideoBackgroundUrl } from '@/lib/backgroundMedia';
import { cn } from '@/lib/utils';

interface BgMediaProps {
  url: string;
  className?: string;
  style?: React.CSSProperties;
  /** 视频占位图（数据未就绪前显示） */
  poster?: string;
  /**
   * 播放时机：
   * - 'viewport'（默认）进视口自动播、离屏/切后台暂停，适合整页壁纸与预览大图
   * - 'hover' 悬停才播（触屏退化为视口过半才播），适合壁纸墙/预设卡片这类密集缩略图
   * - 'none' 只加载首帧不播放
   */
  playTrigger?: 'viewport' | 'hover' | 'none';
  onError?: React.ReactEventHandler<HTMLElement>;
}

/** 壁纸媒体：视频 URL 渲染 <video>，其余渲染 <img>。 */
export function BgMedia({
  url,
  className,
  style,
  poster,
  playTrigger = 'viewport',
  onError,
}: BgMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || playTrigger === 'none') return;
    const tryPlay = () => {
      v.play().catch(() => {});
    };
    if (playTrigger === 'hover' && window.matchMedia('(hover: hover)').matches) {
      const onEnter = () => tryPlay();
      const onLeave = () => v.pause();
      v.addEventListener('pointerenter', onEnter);
      v.addEventListener('pointerleave', onLeave);
      return () => {
        v.removeEventListener('pointerenter', onEnter);
        v.removeEventListener('pointerleave', onLeave);
      };
    }
    // 'viewport' 以及触屏下的 'hover' 退化：视口驱动；页面切后台时统一暂停省解码
    let inView = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (entry.isIntersecting && !document.hidden) tryPlay();
        else v.pause();
      },
      { threshold: playTrigger === 'hover' ? 0.5 : 0.1 },
    );
    const onVisibility = () => {
      if (document.hidden) v.pause();
      else if (inView) tryPlay();
    };
    document.addEventListener('visibilitychange', onVisibility);
    observer.observe(v);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [playTrigger]);

  if (isVideoBackgroundUrl(url)) {
    return (
      <video
        ref={videoRef}
        src={resolveApiAssetUrl(url)}
        muted
        loop
        playsInline
        disablePictureInPicture
        poster={poster}
        preload={poster ? 'none' : 'metadata'}
        className={cn('object-cover', className)}
        style={style}
        onError={onError}
      />
    );
  }
  return (
    <img
      src={resolveApiAssetUrl(url)}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('object-cover', className)}
      style={style}
      onError={onError}
    />
  );
}
