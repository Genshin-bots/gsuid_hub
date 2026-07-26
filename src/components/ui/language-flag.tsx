import { cn } from '@/lib/utils';

export type LanguageFlagCode = 'cn' | 'us' | 'jp';

interface LanguageFlagProps {
  code: LanguageFlagCode;
  className?: string;
}

const flagViewBox = '0 0 32 24';

function ChinaFlag() {
  return (
    <>
      <rect width="32" height="24" rx="3" fill="#DE2910" />
      <path d="M7.2 4.1 8 6.3h2.3L8.5 7.6l.7 2.1-2-1.3-1.9 1.3.7-2.1-1.8-1.3h2.3l.7-2.2Z" fill="#FFDE00" />
      <path d="m13.8 3.7.2 1 .9.2-.8.5.1 1-.7-.7-.9.4.4-.9-.7-.7 1 .1.5-.9ZM16.2 6.7l-.2 1 .8.5-1 .1-.3.9-.5-.8h-1l.7-.7-.3-.9.9.4.9-.5ZM16.1 10.3l-.5.8.5.8-.9-.2-.6.7-.1-1-.9-.4.9-.3.1-1 .6.7.9-.1ZM13.7 13.2l.2.9.9.2-.8.5.1 1-.7-.7-.9.4.4-.9-.7-.7 1 .1.5-.8Z" fill="#FFDE00" />
    </>
  );
}

function UnitedStatesFlag() {
  return (
    <>
      <rect width="32" height="24" rx="3" fill="#fff" />
      {Array.from({ length: 7 }).map((_, index) => (
        <rect key={index} y={index * 24 / 7} width="32" height={24 / 13} fill="#B22234" />
      ))}
      <rect width="14" height="12.9" rx="2.2" fill="#3C3B6E" />
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 4 }).map((__, col) => (
          <circle key={`${row}-${col}`} cx={2.2 + col * 3.2 + (row % 2 ? 1.6 : 0)} cy={2.1 + row * 2.1} r="0.35" fill="#fff" />
        ))
      )}
    </>
  );
}

function JapanFlag() {
  return (
    <>
      <rect width="32" height="24" rx="3" fill="#fff" />
      <circle cx="16" cy="12" r="6" fill="#BC002D" />
    </>
  );
}

const flagMap: Record<LanguageFlagCode, () => JSX.Element> = {
  cn: ChinaFlag,
  us: UnitedStatesFlag,
  jp: JapanFlag,
};

export function LanguageFlag({ code, className }: LanguageFlagProps) {
  const Flag = flagMap[code];
  // code 缺失/非法时不要渲染 undefined 组件（否则 React 报 Element type is invalid）
  if (!Flag) {
    return (
      <span
        className={cn(
          'inline-flex h-4 w-6 shrink-0 rounded-[4px] border border-border/60 bg-muted',
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[4px] border border-border/60 bg-background shadow-sm ring-1 ring-black/5',
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox={flagViewBox} className="!h-full !w-full" role="img" focusable="false">
        <Flag />
      </svg>
    </span>
  );
}
