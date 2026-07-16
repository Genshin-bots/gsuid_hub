import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// PinnedPage —— 固定标题页骨架
// ============================================================================
//
// 「H1 + 副标题（+ 同行右侧操作按钮）（+ 操作控件行） + 竖向内容流」这类标题页的统一骨架：
// 桌面（≥768px）标题区与操作控件行常驻视口，只有下方内容滚动；移动端（<768px）退回
// 普通文档滚动，整个标题区随内容一起滚走（移动端竖向空间稀缺，常驻会吃掉 ~22% 屏幕）。
//
// 机制细节见 src/index.css 的 `.page-pinned` 段落。本组件只负责：
//   1. 挂上 .page-pinned / .page-pinned-header / .page-pinned-toolbar / .page-pinned-body 契约类；
//   2. 用 Tailwind 工具类提供 display/gap（CSS 段落里不能写，会压掉调用方的 gap-*）。
//
// 布局是**扁平的单层 flex column**：header / toolbar / body 三者是同级兄弟，
// 共用根容器的同一个 `gap-*`。这样「标题→控件行→内容」的间距节奏与迁移前
// 的 `space-y-6`（三者同为 space-y 的兄弟）逐像素一致，也不需要再为控件行单开一个 gap 属性。
//
// 用法：
//   <PinnedPage
//     header={<div>…H1 + 副标题…</div>}
//     toolbar={<TabButtonGroup … />}   // 可选
//   >
//     …卡片、列表…
//   </PinnedPage>
//
// 不适用的两类页面（不要套 PinnedPage）：
//   - 无标题的全高单卡片页（/ai-history、/session-management）→ 用 `.page-fill`；
//   - 有标题但页面内部自管滚动的页（/ai-kanban 横向看板）→ 用 `.page-viewport`。

interface PinnedPageProps {
  /**
   * 固定区（第一行）。放标题块（H1 + 副标题）以及**与标题同行**的右侧操作按钮。
   */
  header: React.ReactNode;
  /**
   * 固定区（第二行，可选）。紧贴标题下方的**操作控件行**——TabButtonGroup / 二级切换 /
   * 筛选搜索栏 / 与之同行的操作按钮，随标题一起常驻。
   *
   * 判定标准：**只有「操作控件」才放这里**。统计卡、看板、提示 banner 等「数据展示」
   * 属于内容，应留在 children 里跟着滚（如 /ai-memory、/dashboard 的统计区）。
   *
   * 可以直接传条件表达式，falsy 时不渲染、也不会多出一段 gap：
   *   toolbar={!isLoading && cats.length > 0 && <div>…</div>}
   */
  toolbar?: React.ReactNode;
  /** 滚动区内容 */
  children: React.ReactNode;
  /**
   * 滚动区的布局类，默认 `space-y-6`（与标题页 space-y-6 的块间距一致）。
   * 页面原本是 space-y-3 / space-y-4 的，原样传进来即可。
   */
  bodyClassName?: string;
  /**
   * 根容器附加类。默认 `gap-6`——它同时决定「标题↔控件行↔内容」三段间距；
   * 传 `gap-3` / `gap-4` 可覆盖（cn 用的是 tailwind-merge，后传的赢）。
   */
  className?: string;
}

export function PinnedPage({ header, toolbar, children, bodyClassName, className }: PinnedPageProps) {
  return (
    <div className={cn('page-pinned flex flex-col gap-6', className)}>
      <div className="page-pinned-header">{header}</div>
      {/* falsy 时整段不渲染，避免留下一个空 flex item 撑出多余 gap */}
      {toolbar ? <div className="page-pinned-toolbar">{toolbar}</div> : null}
      <div className={cn('page-pinned-body', bodyClassName ?? 'space-y-6')}>{children}</div>
    </div>
  );
}
