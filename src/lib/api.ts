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
  plugin_black_list: string[];
  plugin_white_list: string[];
  prefix: string[];
  force_prefix: string[];
  disable_force_prefix: boolean;
  allow_empty_prefix: boolean;
}

export interface SvItem {
  name: string;
  enabled: boolean;
  pm: number;
  priority: number;
  area: string;
  black_list: string[];
  white_list: string[];
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
// Plugins APIs
// ===================

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
  getPlugins: () =>
    api.get<Plugin[]>('/api/plugins'),

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
// Framework Config APIs
// ===================

export interface FrameworkConfig {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, PluginConfigItem>;
}

export const frameworkConfigApi = {
  getFrameworkConfigs: () =>
    api.get<FrameworkConfig[]>('/api/framework-config'),

  updateFrameworkConfig: (configName: string, config: Record<string, unknown>) =>
    api.post<{ status: number; msg: string }>(`/api/framework-config/${configName}`, config),
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
    level?: string;
    source?: string;
    page?: number;
    per_page?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.level) query.set('level', params.level);
    if (params.source) query.set('source', params.source);
    if (params.page) query.set('page', String(params.page));
    if (params.per_page) query.set('per_page', String(params.per_page));

    return api.get<LogResponse>(`/api/logs?${query.toString()}`);
  },

  getSources: () =>
    api.get<string[]>('/api/logs/sources'),

  getStats: (params: {
    date?: string;
    level?: string;
    source?: string;
    per_page?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.level) query.set('level', params.level);
    if (params.source) query.set('source', params.source);
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

  getTableData: (tableName: string, page: number = 1, perPage: number = 20) =>
    api.get<PaginatedData>(`/api/database/table/${tableName}/data?page=${page}&per_page=${perPage}`),

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