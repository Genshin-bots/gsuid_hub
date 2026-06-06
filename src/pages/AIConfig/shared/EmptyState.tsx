export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
}

/**
 * 通用空状态：居中显示图标 + 标题 + 可选副标题。
 * 被「无 AI 配置」、「无配置文件」、「无可选 MCP 工具」等多处复用。
 */
export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex items-center justify-center mb-4 text-muted-foreground/50">
        {icon}
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
      )}
    </div>
  );
}
