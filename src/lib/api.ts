/**
 * API Client for GsCore Backend
 * Provides typed API calls for the frontend
 */

// Base URL - empty string means relative to current origin
// Can be customized by user in settings (e.g., 127.0.0.1:8765)
let API_BASE = '';

// Initialize API_BASE from localStorage
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('custom_api_host');
  if (stored) {
    API_BASE = stored;
  }
}

export function getCustomApiHost(): string {
  return API_BASE;
}

// Get the login path based on the current base URL (supports both dev and production paths)
export function getLoginPath(): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  // Remove trailing slash and ensure it starts with /
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/login`;
}

export function setCustomApiHost(host: string): void {
  API_BASE = host;
  // Update the api instance's baseUrl
  api.setBaseUrl(host);
  if (host) {
    localStorage.setItem('custom_api_host', host);
  } else {
    localStorage.removeItem('custom_api_host');
  }
}

// ===================
// Types
// ===================

export interface ApiResponse<T = unknown> {
  status: number;
  msg: string;
  data: T;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar?: string;
}

// ===================
// Token Management
// ===================

let authToken: string | null = null;

// Load token from localStorage on init
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('auth_token');
  if (stored) {
    authToken = stored;
  }
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export interface KeyMetrics {
  dau: number;
  dag: number;
  mau: number;
  mag: number;
  retention: string;
  newUsers: number;
  churnedUsers: number;
  dauMauRatio: string;
  dagMagRatio: string;
}

export interface CommandData {
  date: string;
  sentCommands: number;
  receivedCommands: number;
  commandCalls: number;
  imageGenerated: number;
}

export interface UserGroupData {
  date: string;
  users: number;
  groups: number;
}

export interface DailyCommandData {
  command: string;
  count: number;
}

export interface CoreConfig {
  [key: string]: unknown;
}

export interface ServiceConfig {
  enabled: boolean;
  pm: number;
  priority: number;
  area: string;
  black_list: string[];
  white_list: string[];
  prefix: string[];
  force_prefix: string[];
  disable_force_prefix: boolean;
  allow_empty_prefix: boolean;
}

export interface SvCommand {
  type: string;
  keyword: string;
  block: boolean;
  to_me: boolean;
}

export interface SvItem {
  name: string;
  enabled: boolean;
  pm: number;
  priority: number;
  area: string;
  black_list: string[];
  white_list: string[];
  commands?: SvCommand[];
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: string;
  icon?: string;
  config: Record<string, PluginConfigItem>;
  config_groups?: PluginConfigGroup[];
  config_names?: string[];  // 配置名称列表，用于判断是否需要显示 toggle group
  service_config?: ServiceConfig;
  sv_list?: SvItem[];
}

// Plugin config item type
export interface PluginConfigItem {
  value: unknown;
  default: unknown;
  type: string;
  title?: string;
  desc?: string;
  options?: string[];
  upload_to?: string;
  filename?: string;
  suffix?: string;
}

export interface PluginConfigGroup {
  config_name: string;
  config: Record<string, PluginConfigItem>;
}

export interface LogEntry {
  id?: number;
  level: string;
  source: string;
  message: string;
  timestamp: string;
  details?: { stack?: string };
}

export interface LogResponse {
  count: number;
  rows: LogEntry[];
  page: number;
  per_page: number;
}

export interface SchedulerJob {
  id: string;
  name: string;
  description: string;
  next_run_time: string | null;
  trigger: string;
  trigger_description: string;
  paused: boolean;
}

export interface BackupFile {
  fileName: string;
  downloadUrl: string;
  deleteUrl: string;
  size: number;
  created: string;
}

export interface DatabaseTable {
  name: string;
  count: number;
  description: string;
}

export interface DatabaseColumn {
  name: string;
  title: string;
  type: string;
  nullable: boolean;
  default: unknown;
}

export interface DatabaseTableInfo {
  table_name: string;
  label: string;
  pk_name: string;
  columns: DatabaseColumn[];
}

export interface PluginDatabaseInfo {
  plugin_id: string;
  plugin_name: string;
  tables: DatabaseTableInfo[];
  icon?: string;
}

export interface PaginatedData {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  per_page: number;
}

export interface SystemInfo {
  version: string;
  python_version: string;
  uptime: string;
}

// ===================
// API Client
// ===================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Get auth token
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      credentials: 'include', // Include cookies for authentication
    });

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      setAuthToken(null);
      localStorage.removeItem('auth_user');
      window.location.href = getLoginPath();
      throw new Error('会话已过期，请重新登录');
    }

    // Handle non-OK responses
    if (!response.ok) {
      // Try to parse error message from response
      let errorMessage = `HTTP Error: ${response.status}`;
      try {
        const text = await response.text();
        // Try to parse as JSON first
        try {
          const errorData = JSON.parse(text);
          if (errorData.msg) {
            errorMessage = errorData.msg;
          } else if (typeof errorData === 'string') {
            errorMessage = text;
          }
        } catch {
          // Not JSON, use raw text if available
          if (text) {
            errorMessage = text;
          }
        }
      } catch {
        // Ignore parsing errors
      }
      throw new Error(errorMessage);
    }

    const data: ApiResponse<T> = await response.json();

    if (data.status !== 0) {
      throw new Error(data.msg || 'API request failed');
    }

    return data.data;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Get raw response with status (for theme config which needs full response)
  async getRaw<T>(endpoint: string): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      setAuthToken(null);
      localStorage.removeItem('auth_user');
      window.location.href = getLoginPath();
      throw new Error('会话已过期，请重新登录');
    }

    const data: ApiResponse<T> = await response.json();
    return data;
  }
}

// Create API client instance
export const api = new ApiClient(API_BASE);

// ===================
// Dashboard APIs
// ===================

export interface BotItem {
  id: string;
  name: string;
}

export const dashboardApi = {
  getMetrics: (botId: string = 'all') =>
    api.get<KeyMetrics>(`/api/dashboard/metrics?bot_id=${botId}`),

  getCommands: (botId: string = 'all') =>
    api.get<CommandData[]>(`/api/dashboard/commands?bot_id=${botId}`),

  getUsersGroups: (botId: string = 'all') =>
    api.get<UserGroupData[]>(`/api/dashboard/users-groups?bot_id=${botId}`),

  getDailyCommands: (date: string, botId: string = 'all') =>
    api.get<DailyCommandData[]>(`/api/dashboard/daily/commands?date=${date}&bot_id=${botId}`),

  getDailyGroupTriggers: (date: string, botId: string = 'all') =>
    api.get<any[]>(`/api/dashboard/daily/group-triggers?date=${date}&bot_id=${botId}`),

  getDailyPersonalTriggers: (date: string, botId: string = 'all') =>
    api.get<any[]>(`/api/dashboard/daily/personal-triggers?date=${date}&bot_id=${botId}`),

  getBots: () =>
    api.get<BotItem[]>('/api/dashboard/bots'),
};

// ===================
// Core Config APIs
// ===================

export const configApi = {
  getCoreConfig: () =>
    api.get<CoreConfig>('/api/core/config'),

  setCoreConfig: (config: CoreConfig) =>
    api.post<{ status: number; msg: string }>('/api/core/config', config),
};

// ===================
// Plugins APIs (New - separate list and detail endpoints)
// ===================

// 插件列表项（轻量级）
export interface PluginListItem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: string;
  icon?: string;
}

// ===================
// Plugins APIs
// ===================

export interface StorePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  icon?: string;
  cover?: string;
  avatar?: string;
  link?: string;
  branch?: string;
  type?: string;
  content?: string;
  info?: string;
  installMsg?: string;
  alias?: string[];
  downloadCount?: number;
  rating?: number;
  installed: boolean;
  hasUpdate: boolean;
  status?: 'installed' | 'update_available' | 'not_installed';
  isFun?: boolean;
  isTool?: boolean;
}

// 插件商城列表响应类型
export interface PluginStoreListResponse {
  plugins: StorePlugin[];
  fun_plugins: string[];
  tool_plugins: string[];
}

export const pluginsApi = {
  // 获取插件列表（轻量级接口）
  getPluginList: () =>
    api.get<PluginListItem[]>(`/api/plugins/list?_t=${Date.now()}`),

  // 获取插件详情（包含完整配置）
  getPlugin: (pluginName: string) =>
    api.get<Plugin>(`/api/plugins/${pluginName}?_t=${Date.now()}`),

  // 获取所有插件（兼容旧接口）
  getPlugins: () =>
    api.get<Plugin[]>(`/api/plugins?_t=${Date.now()}`),

  updatePlugin: (pluginName: string, config: Record<string, unknown>) =>
    api.post<{ status: number; msg: string }>(`/api/plugins/${pluginName}`, config),

  togglePlugin: (pluginName: string, enabled: boolean) =>
    api.post<{ status: number; msg: string }>(`/api/plugins/${pluginName}/toggle?enabled=${enabled}`),

  updateServiceConfig: (pluginName: string, config: Record<string, unknown>) =>
    api.post<{ status: number; msg: string }>(`/api/plugins/${pluginName}/service`, config),

  updateSvConfig: (pluginName: string, svName: string, config: Record<string, unknown>) =>
    api.post<{ status: number; msg: string }>(`/api/plugins/${pluginName}/sv/${svName}`, config),
};

// ===================
// Framework Config APIs (New - separate list and detail)
// ===================

// 框架配置列表项（轻量级）
export interface FrameworkConfigListItem {
  id: string;
  name: string;
  full_name: string;
}

// 框架配置详情
export interface FrameworkConfigDetail {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, PluginConfigItem>;
}

// 兼容旧接口的 FrameworkConfig 类型
export interface FrameworkConfig {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, PluginConfigItem>;
}

export const frameworkConfigApi = {
  // 获取框架配置列表（轻量级接口）
  getFrameworkConfigList: (prefix: string = 'GsCore') =>
    api.get<FrameworkConfigListItem[]>(`/api/framework-config/list?prefix=${prefix}`),

  // 获取框架配置详情
  getFrameworkConfig: (configName: string) =>
    api.get<FrameworkConfigDetail>(`/api/framework-config/${configName}`),

  // 兼容旧接口 - 获取所有框架配置
  getFrameworkConfigs: () =>
    api.get<FrameworkConfig[]>('/api/framework-config'),

  // 更新框架配置
  updateFrameworkConfig: (configName: string, config: Record<string, unknown>) =>
    api.post<{ status: number; msg: string }>(`/api/framework-config/${configName}`, config),

  // 更新单个框架配置项
  updateFrameworkConfigItem: (configName: string, itemName: string, value: unknown) =>
    api.post<{ status: number; msg: string }>(`/api/framework-config/${configName}/item/${itemName}`, { value }),
};

// ===================
// OpenAI Config APIs
// ===================

export interface OpenAIConfigOptions {
  base_url: string[];
  model_name: string[];
  embedding_model: string[];
  model_support: string[];
}

export interface OpenAIConfigData {
  base_url: string;
  api_key: string[];
  model_name: string;
  embedding_model: string;
  model_support: string[];
}

export interface OpenAIConfigDetail {
  name: string;
  config: OpenAIConfigData;
}

export interface OpenAIConfigListResponse {
  configs: string[];
  current: string;
}

export const openaiConfigApi = {
  // 获取 OpenAI 配置文件列表
  getConfigList: () =>
    api.get<OpenAIConfigListResponse>('/api/openai_config/list'),

  // 获取 OpenAI 配置详情
  getConfig: (configName: string) =>
    api.get<OpenAIConfigDetail>(`/api/openai_config/${configName}`),

  // 创建或更新 OpenAI 配置文件
  saveConfig: (configName: string, config: OpenAIConfigData) =>
    api.post<{ status: number; msg: string; data: { name: string } }>(`/api/openai_config/${configName}`, { config }),

  // 创建默认配置的 OpenAI 配置文件
  createDefault: (configName: string) =>
    api.post<{ status: number; msg: string }>(`/api/openai_config/${configName}/create_default`),

  // 删除 OpenAI 配置文件
  deleteConfig: (configName: string) =>
    api.delete<{ status: number; msg: string }>(`/api/openai_config/${configName}`),

  // 重命名 OpenAI 配置文件
  renameConfig: (oldName: string, newName: string) =>
    api.post<{ status: number; msg: string; data: { old_name: string; new_name: string } }>(
      `/api/openai_config/${oldName}/rename?new_name=${encodeURIComponent(newName)}`
    ),

  // 获取当前激活的 OpenAI 配置
  getCurrentConfig: () =>
    api.get<OpenAIConfigDetail>('/api/openai_config/current'),

  // 切换 OpenAI 配置文件（热切换）
  switchConfig: (configName: string) =>
    api.post<{ status: number; msg: string; data: { name: string } }>(`/api/openai_config/${configName}/switch`),

  // 获取 OpenAI 配置可选项
  getOptions: () =>
    api.get<OpenAIConfigOptions>('/api/openai_config/options'),
};

// ===================
// Provider Config APIs
// ===================

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  config_count: number;
  configs: string[]; // provider++name 格式
}

export interface ProviderListData {
  providers: ProviderInfo[];
  current: string;
}

export interface ProviderConfigField {
  title: string;
  desc: string;
  data: unknown;
  options?: string[];
}

export interface ProviderConfigDetail {
  name: string;       // provider++name 格式
  provider: string;
  config_name: string; // 纯配置名
  config: Record<string, ProviderConfigField>;
}

export interface TaskConfigResponse {
  task_level: string;
  current_config: string;
  current_provider: string;
  config_detail: ProviderConfigDetail;
  available_configs: Record<string, string[]>;
}

export interface AllConfigItem {
  name: string;       // provider++name 格式
  provider: string;
  config_name: string; // 纯配置名
  model_name: string;
  base_url: string;
}

export interface AllConfigsSummary {
  configs: AllConfigItem[];
  current_provider: string;
  high_level_config: string;   // provider++name 格式
  low_level_config: string;    // provider++name 格式
}

export interface ProviderConfigOptions {
  provider: string;
  options: {
    base_url: string[];
    model_name: string[];
    embedding_model: string[];
    model_support: string[];
  };
}

export const providerConfigApi = {
  // 获取 Provider 列表
  getProviders: () =>
    api.get<ProviderListData>('/api/provider_config/providers'),

  // 设置 Provider
  setProvider: (provider: string) =>
    api.post<{ status: number; msg: string; data: { provider: string } }>(
      `/api/provider_config/provider/${provider}`
    ),

  // 获取任务级别配置
  getTaskConfig: (taskLevel: 'high' | 'low') =>
    api.get<TaskConfigResponse>(`/api/provider_config/task_config/${taskLevel}`),

  // 设置任务级别配置
  setTaskConfig: (taskLevel: 'high' | 'low', configName: string, provider?: string) =>
    api.post<{ status: number; msg: string; data: { task_level: string; config_name: string; provider: string } }>(
      `/api/provider_config/task_config/${taskLevel}`,
      { config_name: configName, provider }
    ),

  // 清除任务级别配置
  clearTaskConfig: (taskLevel: 'high' | 'low') =>
    api.delete<{ status: number; msg: string }>(
      `/api/provider_config/task_config/${taskLevel}`
    ),

  // 获取所有配置摘要
  getAllConfigs: () =>
    api.get<AllConfigsSummary>('/api/provider_config/all_configs'),

  // 获取配置详情
  getConfigDetail: (provider: string, configName: string) =>
    api.get<{ name: string; provider: string; config_name: string; config: Record<string, ProviderConfigField> }>(
      `/api/provider_config/config/${provider}/${configName}`
    ),

  // 创建或更新配置
  saveConfig: (provider: string, configName: string, config: Record<string, { data: unknown }>) =>
    api.post<{ status: number; msg: string; data: { name: string; provider: string; config_name: string } }>(
      `/api/provider_config/config/${provider}/${configName}`,
      { config }
    ),

  // 创建默认配置
  createDefaultConfig: (provider: string, configName: string) =>
    api.post<{ status: number; msg: string; data: { name: string; provider: string; config_name: string } }>(
      `/api/provider_config/config/${provider}/${configName}/create_default`
    ),

  // 删除配置
  deleteConfig: (provider: string, configName: string) =>
    api.delete<{ status: number; msg: string }>(
      `/api/provider_config/config/${provider}/${configName}`
    ),

  // 重命名配置（通过创建新配置+删除旧配置实现）
  renameConfig: async (provider: string, oldName: string, newName: string, apiClient: typeof api): Promise<{ status: number; msg: string }> => {
    // 1. 获取旧配置详情
    const detail = await apiClient.get<{ name: string; provider: string; config_name: string; config: Record<string, ProviderConfigField> }>(
      `/api/provider_config/config/${provider}/${oldName}`
    );
    // 2. 用新名字保存配置
    const configData: Record<string, { data: unknown }> = {};
    for (const [key, field] of Object.entries(detail.config)) {
      configData[key] = { data: field.data };
    }
    await apiClient.post<{ status: number; msg: string }>(
      `/api/provider_config/config/${provider}/${newName}`,
      { config: configData }
    );
    // 3. 删除旧配置
    return apiClient.delete<{ status: number; msg: string }>(
      `/api/provider_config/config/${provider}/${oldName}`
    );
  },

  // 获取配置可选项
  getConfigOptions: (provider: string) =>
    api.get<ProviderConfigOptions>(`/api/provider_config/config/${provider}/options`),

  // --- 兼容旧接口 ---
  // 获取高级任务配置 (兼容旧版)
  getHighLevelConfig: () =>
    api.get<TaskConfigResponse>('/api/provider_config/task_config/high'),

  // 获取低级任务配置 (兼容旧版)
  getLowLevelConfig: () =>
    api.get<TaskConfigResponse>('/api/provider_config/task_config/low'),

  // 设置高级任务配置 (兼容旧版)
  setHighLevelConfig: (configName: string, provider?: string) =>
    api.post<{ status: number; msg: string; data: { task_level: string; config_name: string; provider: string } }>(
      `/api/provider_config/task_config/high`,
      { config_name: configName, provider }
    ),

  // 设置低级任务配置 (兼容旧版)
  setLowLevelConfig: (configName: string, provider?: string) =>
    api.post<{ status: number; msg: string; data: { task_level: string; config_name: string; provider: string } }>(
      `/api/provider_config/task_config/low`,
      { config_name: configName, provider }
    ),
};

// ===================
// Embedding Config APIs
// ===================

export interface EmbeddingConfigField {
  title: string;
  desc: string;
  data: unknown;
  options?: string[];
}

export interface EmbeddingProviderData {
  provider: string;
  available_providers: string[];
}

export interface EmbeddingConfigSummary {
  provider: string;
  available_providers: string[];
  local_config: Record<string, EmbeddingConfigField>;
  openai_config: Record<string, EmbeddingConfigField>;
}

export const embeddingConfigApi = {
  // 获取当前嵌入模型提供方
  getProvider: () =>
    api.get<EmbeddingProviderData>('/api/embedding_config/provider'),

  // 设置嵌入模型提供方
  setProvider: (provider: string) =>
    api.post<{ status: number; msg: string; data: { provider: string } }>(
      '/api/embedding_config/provider',
      { provider }
    ),

  // 获取本地嵌入模型配置
  getLocalConfig: () =>
    api.get<Record<string, EmbeddingConfigField>>('/api/embedding_config/local'),

  // 保存本地嵌入模型配置
  saveLocalConfig: (config: Record<string, unknown>) =>
    api.post<{ status: number; msg: string }>('/api/embedding_config/local', config),

  // 获取 OpenAI 嵌入模型配置
  getOpenaiConfig: () =>
    api.get<Record<string, EmbeddingConfigField>>('/api/embedding_config/openai'),

  // 保存 OpenAI 嵌入模型配置
  saveOpenaiConfig: (config: Record<string, unknown>) =>
    api.post<{ status: number; msg: string }>('/api/embedding_config/openai', config),

  // 获取嵌入模型配置摘要（一次性获取所有配置）
  getSummary: () =>
    api.get<EmbeddingConfigSummary>('/api/embedding_config/summary'),
};

// ===================
// Plugin Store APIs
// ===================

export const pluginStoreApi = {
  getPluginList: () =>
    api.get<PluginStoreListResponse>('/api/plugin-store/list'),

  installPlugin: (pluginId: string, repoUrl?: string) =>
    api.post<{ status: number; msg: string }>(`/api/plugin-store/install/${pluginId}`, { repo_url: repoUrl || '' }),

  updatePlugin: (pluginId: string) =>
    api.post<{ status: number; msg: string }>(`/api/plugin-store/update/${pluginId}`),

  uninstallPlugin: (pluginId: string) =>
    api.delete<{ status: number; msg: string }>(`/api/plugin-store/uninstall/${pluginId}`),
};

// ===================
// Logs APIs
// ===================

export const logsApi = {
  getLogs: (params: {
    date?: string;
    start_date?: string;
    end_date?: string;
    level?: string;
    source?: string;
    search?: string;
    page?: number;
    per_page?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.level) query.set('level', params.level);
    if (params.source) query.set('source', params.source);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.per_page) query.set('per_page', String(params.per_page));

    return api.get<LogResponse>(`/api/logs?${query.toString()}`);
  },

  getSources: () =>
    api.get<string[]>('/api/logs/sources'),

  getStats: (params: {
    date?: string;
    start_date?: string;
    end_date?: string;
    level?: string;
    source?: string;
    search?: string;
    per_page?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.level) query.set('level', params.level);
    if (params.source) query.set('source', params.source);
    if (params.search) query.set('search', params.search);
    if (params.per_page) query.set('per_page', String(params.per_page));

    return api.get<{
      total: number;
      total_pages: number;
      per_page: number;
      info_count?: number;
      warn_count?: number;
      error_count?: number;
      debug_count?: number;
    }>(`/api/logs/stats?${query.toString()}`);
  },

  getAvailableDates: () =>
    api.get<string[]>('/api/logs/available-dates'),
};

// ===================
// Scheduler APIs
// ===================

export const schedulerApi = {
  getJobs: () =>
    api.get<SchedulerJob[]>('/api/scheduler/jobs'),

  runJob: (jobId: string) =>
    api.post<{ status: number; msg: string }>(`/api/scheduler/jobs/${jobId}/run`),

  deleteJob: (jobId: string) =>
    api.delete<{ status: number; msg: string }>(`/api/scheduler/jobs/${jobId}`),

  pauseJob: (jobId: string) =>
    api.post<{ status: number; msg: string }>(`/api/scheduler/jobs/${jobId}/pause`),

  resumeJob: (jobId: string) =>
    api.post<{ status: number; msg: string }>(`/api/scheduler/jobs/${jobId}/resume`),
};

// ===================
// Backup APIs
// ===================

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  children: FileTreeNode[];
}

export const backupApi = {
  getFiles: () =>
    api.get<BackupFile[]>('/api/backup/files'),

  createBackup: () =>
    api.post<{ status: number; msg: string }>('/api/backup/create'),

  deleteFile: (fileId: string) =>
    api.delete<{ status: number; msg: string }>(`/api/backup/${fileId}`),

  getConfig: () =>
    api.get<Record<string, {
      type: string;
      title?: string;
      desc?: string;
      data: unknown;
      options?: string[];
    }>>('/api/backup/config'),

  setConfig: (config: {
    backup_time?: string;
    backup_dir?: string[];
    backup_method?: string[];
    webdav_url?: string;
    webdav_username?: string;
    webdav_password?: string;
  }) =>
    api.post<{ status: number; msg: string }>('/api/backup/config', config),

  getFileTree: () =>
    api.get<FileTreeNode[]>('/api/backup/file-tree'),
};

// ===================
// Database APIs
// ===================

export const databaseApi = {
  getTables: () =>
    api.get<DatabaseTable[]>('/api/database/tables'),

  getPlugins: () =>
    api.get<PluginDatabaseInfo[]>('/api/database/plugins'),

  getPluginTables: (pluginId: string) =>
    api.get<PluginDatabaseInfo>(`/api/database/${pluginId}/tables`),

  getTableMetadata: (tableName: string) =>
    api.get<DatabaseTableInfo>(`/api/database/table/${tableName}`),

  getTableData: (
    tableName: string,
    page: number = 1,
    perPage: number = 20,
    search?: string,
    searchColumns?: string[],
    filterColumns?: string[],
    filterValues?: string[]
  ) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    
    if (search) {
      params.set('search', search);
    }
    if (searchColumns && searchColumns.length > 0) {
      params.set('search_columns', searchColumns.join(','));
    }
    if (filterColumns && filterColumns.length > 0) {
      params.set('filter_columns', filterColumns.join(','));
    }
    if (filterValues && filterValues.length > 0) {
      params.set('filter_values', filterValues.join(','));
    }
    
    return api.get<PaginatedData>(`/api/database/table/${tableName}/data?${params.toString()}`);
  },

  createRecord: (tableName: string, data: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/api/database/table/${tableName}/data`, data),

  updateRecord: (tableName: string, recordId: string | number, data: Record<string, unknown>) =>
    api.put<Record<string, unknown>>(`/api/database/table/${tableName}/data/${recordId}`, data),

  deleteRecord: (tableName: string, recordId: string | number) =>
    api.delete<void>(`/api/database/table/${tableName}/data/${recordId}`),
};

// ===================
// Auth APIs
// ===================

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string }>('/api/auth/login', { email, password }),

  register: (name: string, email: string, password: string, registerCode: string = '', isAdmin: boolean = false) =>
    api.post<{ user: User; token: string; status: number; msg: string }>('/api/auth/register', { name, email, password, register_code: registerCode, is_admin: isAdmin }),

  logout: () =>
    api.post<void>('/api/auth/logout'),

  getCurrentUser: () =>
    api.get<User>('/api/auth/me'),

  // 检查是否已存在管理员账号
  checkAdminExists: () =>
    api.get<{ is_admin_exist: boolean }>('/api/auth/admin/exists'),

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const token = getAuthToken();
    const response = await fetch(`${getCustomApiHost()}/api/auth/avatar`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
      credentials: 'include',
    });

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      setAuthToken(null);
      localStorage.removeItem('auth_user');
      window.location.href = getLoginPath();
      throw new Error('会话已过期，请重新登录');
    }

    const data: ApiResponse<{ avatar: string }> = await response.json();
    if (data.status !== 0) {
      throw new Error(data.msg || 'Upload failed');
    }
    return data.data;
  },

  updateName: (name: string) =>
    api.post<{ name: string }>('/api/auth/name', { name }),

  updatePassword: (oldPassword: string, newPassword: string) =>
    api.post<void>('/api/auth/password', { old_password: oldPassword, new_password: newPassword }),
};

// ===================
// Assets APIs
// ===================

export const assetsApi = {
  upload: async (file: File, uploadTo?: string, targetFilename?: string) => {
    // Convert file to base64 to avoid python-multipart dependency on backend
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    return api.post<{ path: string; url: string }>('/api/assets/upload', {
      image: base64,
      filename: file.name,
      upload_to: uploadTo,
      target_filename: targetFilename
    });
  },

  delete: async (path: string) => {
    return api.delete<{ status: number; msg: string }>(`/api/assets/delete?path=${encodeURIComponent(path)}`);
  },

  getPreviewUrl: (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;

    try {
      // 使用更健壮的 Base64 编码方式处理中文路径
      const bytes = new TextEncoder().encode(path);
      const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
      const encodedPath = btoa(binString);

      const token = getAuthToken();
      // 添加时间戳参数防止浏览器缓存，确保新上传图片能立即显示
      const timestamp = Date.now();
      const baseUrl = `${getCustomApiHost()}/api/assets/preview?path=${encodedPath}&t=${timestamp}`;
      return token ? `${baseUrl}&token=${token}` : baseUrl;
    } catch (e) {
      console.error('Failed to encode path:', e);
      return '';
    }
  }
};

// ===================
// System APIs
// ===================

export const systemApi = {
  getInfo: () =>
    api.get<SystemInfo>('/api/system/info'),

  restartCore: () =>
    api.post<{ status: number; msg: string }>('/api/system/restart'),

  stopCore: () =>
    api.post<{ status: number; msg: string }>('/api/system/stop'),

  resumeCore: () =>
    api.post<{ status: number; msg: string }>('/api/system/resume'),
};

// ===================
// Remote Command APIs
// ===================

export interface RemoteCommandResponse {
  output: string;
  error?: string;
}

export const remoteCommandApi = {
  execute: (command: string) =>
    api.post<RemoteCommandResponse>('/api/remoteCommand', { command }),
};

// ===================
// Theme APIs
// ===================

export interface ThemeConfig {
  mode: 'light' | 'dark';
  style: 'solid' | 'glassmorphism';
  color: string;
  icon_color: 'white' | 'black' | 'colored';
  background_image: string | null;
  blur_intensity: number;
  theme_preset: 'default' | 'shadcn' | 'custom';
  language: 'zh-CN' | 'en-US';
}

export interface ThemeConfigResponse {
  status: number;
  msg: string;
  data: ThemeConfig;
}

export const themeApi = {
  getConfig: () =>
    api.getRaw<ThemeConfig>('/api/theme/config'),

  saveConfig: (config: ThemeConfig) =>
    api.post<{ status: number; msg: string }>('/api/theme/config', config),
};

// ===================
// Persona APIs
// ===================

export interface PersonaListItem {
  name: string;
  has_avatar: boolean;
  has_image: boolean;
  has_audio: boolean;
}

export interface PersonaInfo {
  name: string;
  content: string;
  metadata?: {
    name: string;
    has_avatar: boolean;
    has_image: boolean;
    has_audio: boolean;
  };
}

export interface PersonaCreateRequest {
  name: string;
  query: string;
}

export interface PersonaCreateResponse {
  name: string;
  content: string;
}

export interface PersonaAvatarResponse {
  path: string;
}

export interface PersonaImageResponse {
  path: string;
}

export interface PersonaAudioResponse {
  path: string;
}

export interface PersonaFrameworkConfig {
  id: string;
  name: string;
  full_name: string;
  config: {
    enable_persona: {
      value: string[];
      default: string[];
      type: string;
      title: string;
      desc: string;
      options: string[];
    };
    persona_for_session: {
      value: Record<string, string[]>;
      default: Record<string, string[]>;
      type: string;
      title: string;
      desc: string;
    };
  };
}

// 角色配置相关类型
export type PersonaScope = 'disabled' | 'global' | 'specific';
export type AIMode = '提及应答' | '定时巡检' | '趣向捕捉(暂不可用)' | '困境救场(暂不可用)';

export interface PersonaConfig {
  ai_mode: AIMode[];
  scope: PersonaScope;
  target_groups: string[];
  inspect_interval?: number; // 定时巡检间隔（分钟）：5, 10, 15, 30, 60
  keywords?: string[]; // 触发关键词列表（用于提及应答模式）
}

export interface PersonaConfigResponse {
  status: number;
  msg: string;
  data: PersonaConfig | null;
}

export interface PersonaConfigUpdateRequest {
  ai_mode?: AIMode[];
  scope?: PersonaScope;
  target_groups?: string[];
  inspect_interval?: number;
  keywords?: string[];
}

export interface PersonaConfigUpdateResponse {
  status: number;
  msg: string;
  data: PersonaConfig;
}

export interface AllPersonaConfigsResponse {
  status: number;
  msg: string;
  data: Record<string, PersonaConfig>;
}

export interface GlobalPersonaResponse {
  status: number;
  msg: string;
  data: string | null;
}

export const personaApi = {
  // 获取角色列表
  getPersonaList: () =>
    api.get<PersonaListItem[]>('/api/persona/list'),

  // 获取角色详情
  getPersona: (personaName: string) =>
    api.get<PersonaInfo>(`/api/persona/${encodeURIComponent(personaName)}`),

  // 创建新角色
  createPersona: (data: PersonaCreateRequest) =>
    api.post<PersonaCreateResponse>('/api/persona/create', data),

  // 删除角色
  deletePersona: (personaName: string) =>
    api.delete<{ status: number; msg: string }>(`/api/persona/${encodeURIComponent(personaName)}`),

  // 上传角色头像
  uploadAvatar: (personaName: string, imageData: string) =>
    api.post<PersonaAvatarResponse>(`/api/persona/${encodeURIComponent(personaName)}/avatar`, { image: imageData }),

  // 上传角色立绘
  uploadImage: (personaName: string, imageData: string) =>
    api.post<PersonaImageResponse>(`/api/persona/${encodeURIComponent(personaName)}/image`, { image: imageData }),

  // 上传角色音频
  uploadAudio: (personaName: string, audioData: string, format: string = 'mp3') =>
    api.post<PersonaAudioResponse>(`/api/persona/${encodeURIComponent(personaName)}/audio`, { audio: audioData, format }),

  // 获取角色头像URL
  getAvatarUrl: (personaName: string, timestamp?: number) => {
    const token = getAuthToken();
    const baseUrl = `${getCustomApiHost()}/api/persona/${encodeURIComponent(personaName)}/avatar`;
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (timestamp) params.set('t', String(timestamp));
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  },

  // 获取角色立绘URL
  getImageUrl: (personaName: string, timestamp?: number) => {
    const token = getAuthToken();
    const baseUrl = `${getCustomApiHost()}/api/persona/${encodeURIComponent(personaName)}/image`;
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (timestamp) params.set('t', String(timestamp));
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  },

  // 获取角色音频URL
  getAudioUrl: (personaName: string, timestamp?: number) => {
    const token = getAuthToken();
    const baseUrl = `${getCustomApiHost()}/api/persona/${encodeURIComponent(personaName)}/audio`;
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (timestamp) params.set('t', String(timestamp));
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  },

  // 支持的音频格式
  supportedAudioFormats: ['mp3', 'ogg', 'wav', 'm4a', 'flac'],

  // 获取音频格式优先级
  getAudioFormatPriority: () => ['mp3', 'ogg', 'wav', 'm4a', 'flac'],

  // 获取人格框架配置
  getFrameworkConfig: () =>
    api.get<PersonaFrameworkConfig>('/api/framework-config/GsCore%20AI%20%E4%BA%BA%E8%AE%BE%E9%85%8D%E7%BD%AE'),

  // 获取角色配置
  getPersonaConfig: (personaName: string) =>
    api.get<PersonaConfig>(`/api/persona/${encodeURIComponent(personaName)}/config`),

  // 更新角色配置
  updatePersonaConfig: (personaName: string, config: PersonaConfigUpdateRequest) =>
    api.put<PersonaConfig>(`/api/persona/${encodeURIComponent(personaName)}/config`, config),

  // 更新角色 Markdown 内容
  updatePersonaContent: (personaName: string, content: string) =>
    api.put<{ name: string; content: string }>(
      `/api/persona/${encodeURIComponent(personaName)}/content`,
      { content }
    ),

  // 获取全局启用的角色
  getGlobalPersona: () =>
    api.get<string | null>('/api/persona/config/global'),

  // 获取所有角色配置
  getAllPersonaConfigs: () =>
    api.get<Record<string, PersonaConfig>>('/api/persona/config/all'),
};

// ===================
// AI Tools API
// ===================

export interface AITool {
  name: string;
  description: string;
  plugin: string;
  category: string;
}

// ===================
// AI Skills Types
// ===================

export interface AISkill {
  name: string;
  description: string;
  content: string;
  license: string | null;
  compatibility: string | null;
  uri: string;
  metadata: {
    homepage?: string;
  };
}

export interface AISkillDetail extends AISkill {
  resources: Array<{
    name: string;
    description: string | null;
    uri: string;
  }>;
  scripts: Array<{
    name: string;
    description: string | null;
    uri: string | null;
  }>;
}

export interface AISkillsListResponse {
  skills: AISkill[];
  count: number;
}

// ===================
// AI Skills API
// ===================

export interface AISkillMarkdownResponse {
  skill_name: string;
  content: string;
  path: string;
}

export interface AISkillCloneResponse {
  skill_name: string;
}

export const aiSkillsApi = {
  // 获取 AI 技能列表
  getSkillsList: () =>
    api.get<AISkillsListResponse>('/api/ai/skills/list'),

  // 获取指定技能详情
  getSkillDetail: (skillName: string) =>
    api.get<AISkillDetail>(`/api/ai/skills/${encodeURIComponent(skillName)}`),

  // 删除 AI 技能
  deleteSkill: (skillName: string) =>
    api.delete<{ msg: string }>(`/api/ai/skills/${encodeURIComponent(skillName)}`),

  // 从 Git 克隆 AI 技能
  cloneSkill: (gitUrl: string, skillName?: string) =>
    api.post<AISkillCloneResponse>('/api/ai/skills/clone', {
      git_url: gitUrl,
      skill_name: skillName,
    }),

  // 获取 AI 技能 Markdown 内容
  getSkillMarkdown: (skillName: string) =>
    api.get<AISkillMarkdownResponse>(`/api/ai/skills/${encodeURIComponent(skillName)}/markdown`),

  // 更新 AI 技能 Markdown 内容
  updateSkillMarkdown: (skillName: string, content: string) =>
    api.put<{ msg: string }>(`/api/ai/skills/${encodeURIComponent(skillName)}/markdown`, {
      content,
    }),
};

export interface AIToolsListResponse {
  tools: AITool[];
  by_category: Record<string, AITool[]>;
  by_plugin: Record<string, AITool[]>;
  categories: string[];
  plugins: string[];
  count: number;
  total_count: number;
}

export interface AIToolCategoriesResponse {
  status: number;
  msg: string;
  data: Array<{ name: string; count: number }>;
}

export const aiToolsApi = {
  // 获取 AI 工具列表
  getToolsList: (params?: { category?: string; plugin?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.plugin) query.set('plugin', params.plugin);
    const queryStr = query.toString();
    return api.get<AIToolsListResponse>(`/api/ai/tools/list${queryStr ? `?${queryStr}` : ''}`);
  },

  // 获取工具分类列表
  getToolCategories: () =>
    api.get<AIToolCategoriesResponse>('/api/ai/tools/categories'),

  // 获取指定工具详情
  getToolDetail: (toolName: string) =>
    api.get<{ status: number; msg: string; data: AITool | null }>(`/api/ai/tools/${encodeURIComponent(toolName)}`),
};

// ===================
// AI Knowledge Base API
// ===================

export interface AIKnowledgeItem {
  id: string;
  plugin: string;
  title: string;
  content: string;
  tags: string[];
  source: string;
}

export interface AIKnowledgeListResponse {
  list: AIKnowledgeItem[];
  total: number;
  offset: number;
  limit: number;
  next_offset: number | null;
  page: number;
  page_size: number;
}

export interface AIKnowledgeSearchResponse {
  results: AIKnowledgeItem[];
  count: number;
  query: string;
}

export interface AIKnowledgeCreateRequest {
  plugin?: string;
  title: string;
  content: string;
  tags: string[];
}

export interface AIKnowledgeUpdateRequest {
  title?: string;
  content?: string;
  tags?: string[];
}

export const aiKnowledgeApi = {
  // 获取知识库列表（分页）
  getKnowledgeList: (params: { offset?: number; limit?: number; source?: string; page?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.source) query.set('source', params.source);
    return api.get<AIKnowledgeListResponse>(`/api/ai/knowledge/list?${query.toString()}`);
  },

  // 获取知识详情
  getKnowledgeDetail: (entityId: string) =>
    api.get<AIKnowledgeItem>(`/api/ai/knowledge/${encodeURIComponent(entityId)}`),

  // 新增知识
  createKnowledge: (data: AIKnowledgeCreateRequest) =>
    api.post<{ id: string; title: string }>('/api/ai/knowledge', data),

  // 更新知识
  updateKnowledge: (entityId: string, data: AIKnowledgeUpdateRequest) =>
    api.put<{ id: string }>(`/api/ai/knowledge/${encodeURIComponent(entityId)}`, data),

  // 删除知识
  deleteKnowledge: (entityId: string) =>
    api.delete<{ id: string }>(`/api/ai/knowledge/${encodeURIComponent(entityId)}`),

  // 搜索知识
  searchKnowledge: (query: string, limit: number = 10, source: string = 'all') => {
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('limit', String(limit));
    params.set('source', source);
    return api.get<AIKnowledgeSearchResponse>(`/api/ai/knowledge/search?${params.toString()}`);
  },
};

// ===================
// AI Image RAG API - /api/ai/images
// ===================

export interface AIImageItem {
  id: string;
  plugin: string;
  path: string;
  tags: string[];
  content: string;
  source: string;
}

export interface AIImageUploadResponse {
  filename: string;
  path: string;
  relative_path: string;
}

export interface AIImageListResponse {
  list: AIImageItem[];
  total: number;
  offset: number;
  limit: number;
  next_offset: number | null;
  page: number;
  page_size: number;
}

export interface AIImageSearchResponse {
  results: AIImageItem[];
  count: number;
  query: string;
}

export interface AIImageCreateRequest {
  id?: string;
  plugin?: string;
  path: string;
  tags: string;
  content?: string;
}

export interface AIImageUpdateRequest {
  tags?: string;
  content?: string;
}

export const aiImageApi = {
  // 上传图片
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken();
    const response = await fetch(`${getCustomApiHost()}/api/ai/images/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
      credentials: 'include',
    });

    if (response.status === 401) {
      setAuthToken(null);
      localStorage.removeItem('auth_user');
      window.location.href = getLoginPath();
      throw new Error('会话已过期，请重新登录');
    }

    const data: ApiResponse<AIImageUploadResponse> = await response.json();
    if (data.status !== 0) {
      throw new Error(data.msg || 'Upload failed');
    }
    return data.data;
  },

  // 获取图片列表（分页）
  getImageList: (params: { offset?: number; limit?: number; plugin?: string; page?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.plugin) query.set('plugin', params.plugin);
    return api.get<AIImageListResponse>(`/api/ai/images/list?${query.toString()}`);
  },

  // 创建图片实体（入库）
  createImage: async (data: AIImageCreateRequest) => {
    const formData = new URLSearchParams();
    if (data.id) formData.set('id', data.id);
    if (data.plugin) formData.set('plugin', data.plugin);
    formData.set('path', data.path);
    formData.set('tags', data.tags);
    if (data.content) formData.set('content', data.content);
    
    const token = getAuthToken();
    const response = await fetch(`${getCustomApiHost()}/api/ai/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData.toString(),
      credentials: 'include',
    });

    if (response.status === 401) {
      setAuthToken(null);
      localStorage.removeItem('auth_user');
      window.location.href = getLoginPath();
      throw new Error('会话已过期，请重新登录');
    }

    const result: ApiResponse<{ id: string; path: string; tags: string[] }> = await response.json();
    if (result.status !== 0) {
      throw new Error(result.msg || 'Failed to create image knowledge');
    }
    return result.data;
  },

  // 删除图片
  deleteImage: (entityId: string) =>
    api.delete<{ id: string }>(`/api/ai/images/${encodeURIComponent(entityId)}`),

  // 搜索图片
  searchImages: (query: string, limit: number = 10, plugin?: string) => {
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('limit', String(limit));
    if (plugin) params.set('plugin', plugin);
    return api.get<AIImageSearchResponse>(`/api/ai/images/search?${params.toString()}`);
  },

  // 获取最佳匹配图片路径
  getBestImagePath: (query: string, plugin?: string) => {
    const params = new URLSearchParams();
    params.set('query', query);
    if (plugin) params.set('plugin', plugin);
    return api.get<{ path: string }>(`/api/ai/images/path?${params.toString()}`);
  },
};

// ===================
// History Manager API - /api/history
// ===================

export interface SessionInfo {
  session_id: string;
  session_key: string;
  type: 'private' | 'group';
  group_id: string | null;
  user_id: string | null;
  message_count: number;
  last_access: number | null;
  created_at: number | null;
}

export interface SessionHistoryTextResponse {
  session_id: string;
  content: string;
  count: number;
}

export interface SessionHistoryMessage {
  role: string;
  content: string;
  user_id?: string;
  user_name?: string | null;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface SessionHistoryJSONResponse {
  session_id: string;
  messages: SessionHistoryMessage[];
  count: number;
}

export interface SessionHistoryOpenAIResponse {
  session_id: string;
  messages: Array<{ role: string; content: string }>;
  count: number;
}

export interface ClearHistoryResponse {
  session_id: string;
  cleared?: boolean;
  deleted?: boolean;
}

export interface SessionPersonaResponse {
  session_id: string;
  persona_content: string | null;
}

export interface HistoryStats {
  history_manager: {
    total_sessions: number;
    total_messages: number;
    group_sessions: number;
    max_messages_per_session: number;
  };
  ai_router_sessions: {
    count: number;
    sessions: Record<string, {
      session_id: string;
      last_access: number;
      created_at: number;
      history_length: number;
    }>;
  };
}

export const historyApi = {
  // 获取所有 Session 列表
  getSessions: () =>
    api.get<SessionInfo[]>('/api/history/sessions'),

  // 获取指定 Session 的历史记录
  getSessionHistory: (sessionId: string, formatType: 'text' | 'json' | 'messages' = 'text') =>
    api.get<SessionHistoryTextResponse | SessionHistoryJSONResponse | SessionHistoryOpenAIResponse>(
      `/api/history/${encodeURIComponent(sessionId)}?format_type=${formatType}`
    ),

  // 清空指定 Session 的历史记录
  clearSessionHistory: (sessionId: string, deleteSession: boolean = false) =>
    api.delete<ClearHistoryResponse>(
      `/api/history/${encodeURIComponent(sessionId)}?delete_session=${deleteSession}`
    ),

  // 获取指定 Session 的 Persona 内容
  getSessionPersona: (sessionId: string) =>
    api.get<SessionPersonaResponse>(`/api/history/${encodeURIComponent(sessionId)}/persona`),

  // 获取历史管理器统计信息
  getStats: () =>
    api.get<HistoryStats>('/api/history/stats'),
};

// ===================
// System Prompt API - /api/ai/system_prompt
// ===================

export interface SystemPromptItem {
  id: string;
  title: string;
  desc: string;
  content: string;
  tags: string[];
}

export interface SystemPromptListResponse {
  list: SystemPromptItem[];
  total: number;
  offset: number;
  limit: number;
  page: number;
  page_size: number;
}

export interface SystemPromptSearchResponse {
  results: SystemPromptItem[];
  count: number;
  query: string;
}

export interface SystemPromptCreateRequest {
  title: string;
  desc: string;
  content: string;
  tags: string[];
}

export interface SystemPromptUpdateRequest {
  title?: string;
  desc?: string;
  content?: string;
  tags?: string[];
}

export const systemPromptApi = {
  // 获取System Prompt列表（分页）
  getSystemPromptList: (params: { offset?: number; limit?: number; page?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    return api.get<SystemPromptListResponse>(`/api/ai/system_prompt/list?${query.toString()}`);
  },

  // 获取System Prompt详情
  getSystemPromptDetail: (promptId: string) =>
    api.get<SystemPromptItem>(`/api/ai/system_prompt/${encodeURIComponent(promptId)}`),

  // 新增System Prompt
  createSystemPrompt: (data: SystemPromptCreateRequest) =>
    api.post<{ id: string; title: string }>('/api/ai/system_prompt', data),

  // 更新System Prompt
  updateSystemPrompt: (promptId: string, data: SystemPromptUpdateRequest) =>
    api.put<{ id: string }>(`/api/ai/system_prompt/${encodeURIComponent(promptId)}`, data),

  // 删除System Prompt
  deleteSystemPrompt: (promptId: string) =>
    api.delete<{ id: string }>(`/api/ai/system_prompt/${encodeURIComponent(promptId)}`),

  // 搜索System Prompt
  searchSystemPrompt: (query: string, options: { tags?: string; limit?: number; use_vector?: boolean } = {}) => {
    const params = new URLSearchParams();
    params.set('query', query);
    if (options.tags) params.set('tags', options.tags);
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.use_vector !== undefined) params.set('use_vector', String(options.use_vector));
    return api.get<SystemPromptSearchResponse>(`/api/ai/system_prompt/search?${params.toString()}`);
  },
};

// ===================
// AI Scheduled Tasks API - /api/ai/scheduled_tasks
// ===================

export interface AIScheduledTask {
  task_id: string;
  task_type: 'once' | 'interval';
  user_id: string;
  group_id: string | null;
  bot_id: string;
  bot_self_id: string;
  user_type: 'direct' | 'group';
  persona_name: string;
  session_id: string;
  task_prompt: string;
  status: 'pending' | 'paused' | 'executed' | 'failed' | 'cancelled';
  created_at: string;
  executed_at: string | null;
  result: string | null;
  error_message: string | null;
  interval_seconds: number;
  max_executions: number;
  current_executions: number;
  start_time: string;
  next_run_time: string | null;
}

export interface AIScheduledTaskStats {
  total: number;
  pending: number;
  paused: number;
  executed: number;
  failed: number;
  cancelled: number;
  interval_count: number;
  once_count: number;
}

export interface CreateScheduledTaskRequest {
  task_type: 'once' | 'interval';
  interval_type?: 'minutes' | 'hours' | 'days';
  interval_value?: number;
  task_prompt: string;
  max_executions?: number;
  run_time?: string;
}

export interface UpdateScheduledTaskRequest {
  task_prompt?: string;
  max_executions?: number;
}

export const aiScheduledTasksApi = {
  // 获取任务列表
  getTasks: (params?: { user_id?: string; status?: string; task_type?: string }) => {
    const query = new URLSearchParams();
    if (params?.user_id) query.set('user_id', params.user_id);
    if (params?.status) query.set('status', params.status);
    if (params?.task_type) query.set('task_type', params.task_type);
    const queryString = query.toString();
    return api.get<AIScheduledTask[]>(`/api/ai/scheduled_tasks${queryString ? `?${queryString}` : ''}`);
  },

  // 获取任务详情
  getTaskDetail: (taskId: string) =>
    api.get<AIScheduledTask>(`/api/ai/scheduled_tasks/${encodeURIComponent(taskId)}`),

  // 创建任务
  createTask: (data: CreateScheduledTaskRequest) =>
    api.post<{ task_id: string }>('/api/ai/scheduled_tasks', data),

  // 修改任务
  updateTask: (taskId: string, data: UpdateScheduledTaskRequest) =>
    api.put<{ status: number; msg: string }>(`/api/ai/scheduled_tasks/${encodeURIComponent(taskId)}`, data),

  // 删除任务
  deleteTask: (taskId: string) =>
    api.delete<{ status: number; msg: string }>(`/api/ai/scheduled_tasks/${encodeURIComponent(taskId)}`),

  // 暂停任务
  pauseTask: (taskId: string) =>
    api.post<{ status: number; msg: string }>(`/api/ai/scheduled_tasks/${encodeURIComponent(taskId)}/pause`),

  // 恢复任务
  resumeTask: (taskId: string) =>
    api.post<{ status: number; msg: string }>(`/api/ai/scheduled_tasks/${encodeURIComponent(taskId)}/resume`),

  // 获取任务统计
  getStats: () =>
    api.get<AIScheduledTaskStats>('/api/ai/scheduled_tasks/stats/overview'),
};

// ===================
// Git Mirror API - /api/git-mirror
// ===================

export interface GitMirrorOption {
  label: string;
  value: string;
  type: 'default' | 'mirror' | 'proxy';
}

export interface GitPluginInfo {
  name: string;
  path: string;
  remote_url: string;
  is_git_repo: boolean;
  mirror: 'gitcode' | 'cnb' | 'ghproxy' | 'github' | 'unknown';
}

export interface GitMirrorInfo {
  current_mirror: string;
  available_mirrors: GitMirrorOption[];
  plugins: GitPluginInfo[];
}

export interface GitMirrorSetAllResult {
  name: string;
  success: boolean;
  message: string;
}

export interface GitMirrorSetAllResponse {
  results: GitMirrorSetAllResult[];
  summary: {
    total: number;
    success_count: number;
    fail_count: number;
  };
}

export interface GitMirrorSetPluginResponse {
  name: string;
  success: boolean;
  message: string;
}

export const gitMirrorApi = {
  // 获取 Git 镜像信息
  getInfo: () =>
    api.get<GitMirrorInfo>('/api/git-mirror/info'),

  // 批量设置所有插件的镜像源（同时更新配置）
  setAll: (mirrorPrefix: string) =>
    api.post<GitMirrorSetAllResponse>('/api/git-mirror/set-all', { mirror_prefix: mirrorPrefix }),

  // 设置单个插件的镜像源
  setPlugin: (pluginName: string, mirrorPrefix: string) =>
    api.post<GitMirrorSetPluginResponse>(`/api/git-mirror/set-plugin/${encodeURIComponent(pluginName)}`, { mirror_prefix: mirrorPrefix }),

  // 获取可用镜像源列表
  getAvailable: () =>
    api.get<GitMirrorOption[]>('/api/git-mirror/available'),

  // 仅保存镜像源配置（不影响已安装插件，仅影响后续新安装的插件）
  saveConfig: (mirrorPrefix: string) =>
    frameworkConfigApi.updateFrameworkConfigItem('GsCore', 'GitMirror', mirrorPrefix),
};

// ===================
// MCP Config API
// ===================

export interface MCPConfig {
  config_id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

export interface MCPConfigListResponse {
  configs: MCPConfig[];
  count: number;
}

export interface MCPConfigCreateData {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPConfigUpdateData {
  name?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPReloadResponse {
  old_tool_count: number;
  new_tool_count: number;
  config_count: number;
}

export const mcpConfigApi = {
  // 获取 MCP 配置列表
  getList: () =>
    api.get<MCPConfigListResponse>('/api/ai/mcp/list'),

  // 获取 MCP 配置详情
  getDetail: (configId: string) =>
    api.get<MCPConfig>(`/api/ai/mcp/${encodeURIComponent(configId)}`),

  // 创建 MCP 配置
  create: (data: MCPConfigCreateData) =>
    api.post<{ config_id: string; name: string }>('/api/ai/mcp', data),

  // 更新 MCP 配置
  update: (configId: string, data: MCPConfigUpdateData) =>
    api.put<{ config_id: string }>(`/api/ai/mcp/${encodeURIComponent(configId)}`, data),

  // 删除 MCP 配置
  delete: (configId: string) =>
    api.delete<{ config_id: string }>(`/api/ai/mcp/${encodeURIComponent(configId)}`),

  // 切换启用/禁用状态
  toggle: (configId: string) =>
    api.post<{ config_id: string; enabled: boolean }>(`/api/ai/mcp/${encodeURIComponent(configId)}/toggle`),

  // 热重载所有配置
  reload: () =>
    api.post<MCPReloadResponse>('/api/ai/mcp/reload'),
};

// ===================
// Git Update API
// ===================

export interface GitCommitInfo {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitPluginStatus {
  name: string;
  path: string;
  branch: string;
  is_git_repo: boolean;
  current_commit: GitCommitInfo | null;
}

export interface GitCommitListResponse {
  plugin_name: string;
  branch: string;
  current_hash: string;
  commits: GitCommitInfo[];
}

export interface GitLocalCommitListResponse {
  plugin_name: string;
  branch: string;
  commits: GitCommitInfo[];
}

export interface GitCheckoutResponse {
  success: boolean;
  message: string;
}

export interface GitForceUpdateResponse {
  success: boolean;
  message: string;
  current_commit: GitCommitInfo | null;
}

export const gitUpdateApi = {
  // 获取所有插件的 Git 状态
  getStatus: () =>
    api.get<GitPluginStatus[]>('/api/git-update/status'),

  // 获取单个插件的 Git 状态
  getPluginStatus: (pluginName: string) =>
    api.get<GitPluginStatus>(`/api/git-update/status/${encodeURIComponent(pluginName)}`),

  // 获取远程 Commit 列表
  getRemoteCommits: (pluginName: string, maxCount?: number) => {
    const query = maxCount ? `?max_count=${maxCount}` : '';
    return api.get<GitCommitListResponse>(`/api/git-update/commits/${encodeURIComponent(pluginName)}${query}`);
  },

  // 获取本地 Commit 历史
  getLocalCommits: (pluginName: string, maxCount?: number) => {
    const query = maxCount ? `?max_count=${maxCount}` : '';
    return api.get<GitLocalCommitListResponse>(`/api/git-update/local-commits/${encodeURIComponent(pluginName)}${query}`);
  },

  // 回退到指定 Commit
  checkout: (pluginName: string, commitHash: string) =>
    api.post<GitCheckoutResponse>(`/api/git-update/checkout/${encodeURIComponent(pluginName)}`, { commit_hash: commitHash }),

  // 强制更新
  forceUpdate: (pluginName: string) =>
    api.post<GitForceUpdateResponse>(`/api/git-update/force-update/${encodeURIComponent(pluginName)}`),
};