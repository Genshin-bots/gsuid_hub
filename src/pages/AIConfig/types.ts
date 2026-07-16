/**
 * AIConfigPage 相关的纯类型定义。
 *
 * 这些类型与后端 API 返回结构保持一致，仅保留前端需要的字段。
 * 之所以单独抽出，是为了让多个 section / dialog 共享同样的字段类型。
 */
import type { PluginConfigItem, OpenAIConfigData, MCPToolsConfigItem } from '@/lib/api';

/** 框架配置在页面中的本地表示 */
export interface LocalFrameworkConfig {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, PluginConfigItem>;
}

/** 配置文件列表中的简化结构（用于渲染下拉等） */
export interface ConfigFileItem {
  name: string;
  provider: string;
  model_name: string;
  base_url: string;
}

/** 服务提供方 provider 类型 */
export type ProviderType = 'openai' | 'anthropic' | 'gemini' | string;

/** OpenAI / 兼容格式的配置数据（与后端 OpenAIConfigData 一致） */
export type { OpenAIConfigData };

/** MCP 工具配置 */
export type { MCPToolsConfigItem };
