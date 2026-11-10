import { Discord, Qq, Wechat } from '@thesvg/react';
import { Bot, Globe, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlatformBrandIconProps {
  platform: string;
  size?: number;
  className?: string;
}

/**
 * GsCore 多平台适配器裸品牌图标（无任何圆角矩形或圆形背景底板）。
 * 同时服务于「媒体与图床 → 多平台图片传输策略矩阵」与「消息与交互 → Markdown/按钮平台选择」。
 */
export function PlatformBrandIcon({ platform, size = 16, className }: PlatformBrandIconProps) {
  const key = platform.trim().toLowerCase();
  const baseClass = cn('pointer-events-none inline-block shrink-0', className);

  switch (key) {
    case 'qqgroup':
    case 'qq':
      return <Qq width={size} height={size} className={baseClass} aria-hidden="true" />;

    case 'red':
      return (
        <Qq
          width={size}
          height={size}
          className={cn(baseClass, '[&_path]:!fill-rose-500')}
          aria-hidden="true"
        />
      );

    case 'qqguild':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(baseClass, 'text-indigo-500')}
          aria-hidden="true"
        >
          <path
            d="M9.5 3.75L6.75 20.25M17.25 3.75L14.5 20.25M4.25 9.25H20.25M3.75 14.75H19.75"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'telegram':
      return (
        <svg
          width={size}
          height={size}
          viewBox="42 64 164 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={baseClass}
          aria-hidden="true"
        >
          <path
            fill="#2AABEE"
            d="M57.94 126.648c37.32-16.256 62.2-26.974 74.64-32.152 35.56-14.786 42.94-17.354 47.76-17.441 1.06-.017 3.42.245 4.96 1.49 1.28 1.05 1.64 2.47 1.82 3.467.16.996.38 3.266.2 5.038-1.92 20.24-10.26 69.356-14.5 92.026-1.78 9.592-5.32 12.808-8.74 13.122-7.44.684-13.08-4.912-20.28-9.63-11.26-7.386-17.62-11.982-28.56-19.188-12.64-8.328-4.44-12.906 2.76-20.386 1.88-1.958 34.64-31.748 35.26-34.45.08-.338.16-1.598-.6-2.262-.74-.666-1.84-.438-2.64-.258-1.14.256-19.12 12.152-54 35.686-5.1 3.508-9.72 5.218-13.88 5.128-4.56-.098-13.36-2.584-19.9-4.708-8-2.606-14.38-3.984-13.82-8.41.28-2.304 3.46-4.662 9.52-7.072Z"
          />
        </svg>
      );

    case 'discord':
      return <Discord width={size} height={size} className={baseClass} aria-hidden="true" />;

    case 'ntchat':
    case 'wechat':
      return <Wechat width={size} height={size} className={baseClass} aria-hidden="true" />;

    case 'onebot':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(baseClass, 'text-sky-500')}
          aria-hidden="true"
        >
          <path
            d="M12 3v3m-6.5 2h13A2.5 2.5 0 0 1 21 10.5v6A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-6A2.5 2.5 0 0 1 5.5 8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="13.5" r="1.5" fill="currentColor" />
          <circle cx="15" cy="13.5" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'onebot_v12':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(baseClass, 'text-blue-500')}
          aria-hidden="true"
        >
          <path
            d="M12 2.75 20 7.25v9.5L12 21.25 4 16.75v-9.5L12 2.75Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 12h7M9.5 9.75v4.5M14.5 9.75v4.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'kook':
    case 'kaiheila':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(baseClass, 'text-emerald-500')}
          aria-hidden="true"
        >
          <path
            d="M6 4v16M18.5 4.5 10 12l8.5 7.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'feishu':
    case 'lark':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={baseClass}
          aria-hidden="true"
        >
          <path
            d="M3.5 6.2c4.4.3 8.5 2.4 11.2 5.9l-4.5 3.6C6.7 13.6 4.3 10.2 3.5 6.2Z"
            fill="#00D6B9"
          />
          <path
            d="M20.8 5.5c-2.2 6.8-6.8 11.8-13.8 13.5l2.5-5.7c3.6-.8 7.5-3.6 11.3-7.8Z"
            fill="#3370FF"
          />
        </svg>
      );

    case 'dodo':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(baseClass, 'text-amber-500')}
          aria-hidden="true"
        >
          <path
            d="M5 4.75h6.5a7.25 7.25 0 0 1 0 14.5H7.75L5 21v-16.25Z"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <circle cx="11.75" cy="12" r="2.25" fill="currentColor" />
        </svg>
      );

    case 'villa':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(baseClass, 'text-pink-500')}
          aria-hidden="true"
        >
          <path
            d="M3.5 11.25 12 4l8.5 7.25M6.25 9.75V19.5h11.5V9.75"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 10.75 13.1 13.15 15.5 14.25 13.1 15.35 12 17.75 10.9 15.35 8.5 14.25 10.9 13.15 12 10.75Z"
            fill="currentColor"
          />
        </svg>
      );

    case 'console':
      return (
        <Terminal
          style={{ width: size, height: size }}
          className={cn(baseClass, 'text-emerald-500')}
          aria-hidden="true"
        />
      );

    case 'web':
      return (
        <Globe
          style={{ width: size, height: size }}
          className={cn(baseClass, 'text-primary')}
          aria-hidden="true"
        />
      );

    default:
      return (
        <Bot
          style={{ width: size, height: size }}
          className={cn(baseClass, 'text-muted-foreground')}
          aria-hidden="true"
        />
      );
  }
}
