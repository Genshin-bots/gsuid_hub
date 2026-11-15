import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { inConfigGroupListContext } from './configGroupListContext';

export interface ConfigGroupListProps {
  children: ReactNode;
  className?: string;
}

/**
 * 连续的 `layout="inline"` ConfigGroup 的容器：sm+ 变成一个
 * `max-content` 标签列网格，组内各组的 label / 控件格直接成为网格项，
 * 所有标签共享同一列宽（按最长标签），且标签永不换行。
 */
export function ConfigGroupList({ children, className }: ConfigGroupListProps) {
  return (
    <inConfigGroupListContext.Provider value={true}>
      <div
        className={cn(
          'flex flex-col gap-4 sm:grid sm:grid-cols-[max-content_minmax(0,1fr)] sm:items-start sm:gap-x-6 sm:gap-y-4',
          className,
        )}
      >
        {children}
      </div>
    </inConfigGroupListContext.Provider>
  );
}
