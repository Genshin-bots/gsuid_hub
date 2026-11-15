/**
 * 手写字段列表的统一栅格（与 DynamicConfigPanel 的 3 列网格对齐）。
 * 宽字段（API key tags / URL / textarea）追加 `fieldWideClass` 占满整行。
 */
export const fieldGridClass =
  'grid grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3';
export const fieldWideClass = 'sm:col-span-2 lg:col-span-3';

/** 半宽卡片（xl 双列布局）内的手写字段列表：最多两列 */
export const fieldGrid2Class = 'grid grid-cols-1 items-start gap-x-6 gap-y-3 sm:grid-cols-2';
export const fieldWide2Class = 'sm:col-span-2';
