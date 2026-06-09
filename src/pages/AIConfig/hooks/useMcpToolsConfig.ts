/**
 * useMcpToolsConfig
 *
 * 负责「MCP 工具配置」相关的状态与副作用：
 * - mcpConfigs：MCP 服务列表（每个服务下含 tools）
 * - mcpToolsConfigs / mcpDetailsEditing：当前编辑的工具映射
 * - originalMcpToolsConfigs / originalMcpDetails：保存前快照
 * - mcpToolDialogOpen / mcpToolDialogType：McpToolDialog 的开关与当前 service 类型
 *
 * 由于本 hook 需要在「选择/清空 MCP 工具」时同步写回 framework config 的对应字段
 * （`websearch_mcp_tool_id` 等），调用方必须通过参数传入：
 *   - mcpToolsConfig: 从 useFrameworkConfig().configs 里按 name.includes('MCP 工具配置') 取出的项
 *   - updateConfigValue: 来自 useFrameworkConfig 的字段更新回调
 *   - MCP_SERVICE_TOOLS_CONFIG_KEY_MAP / McpServiceType：来自 @/components/config
 *
 * 这样既保持了原本的「外部权威数据流」（frameworkConfig 为源），
 * 又把"工具详情/工具列表/MCP 服务列表"三块状态封到本 hook。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  mcpConfigApi,
  type MCPToolsConfigItem,
  type MCPConfig,
} from '@/lib/api';
import {
  MCP_SERVICE_TOOLS_CONFIG_KEY_MAP,
  type McpServiceType,
  type ConfigValue,
} from '@/components/config';
import type { LocalFrameworkConfig } from '../types';
import type { McpToolInfo } from '../index';

export interface UseMcpToolsConfigArgs {
  /** 来自 useFrameworkConfig().configs 的「MCP 工具配置」条目 */
  mcpToolsConfig: LocalFrameworkConfig | undefined;
  /** 来自 useFrameworkConfig 的字段写入函数 */
  updateConfigValue: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

export interface UseMcpToolsConfigReturn {
  /** MCP 服务列表 */
  mcpConfigs: MCPConfig[];
  /** 当前正在编辑的 MCP 工具映射 */
  mcpToolsConfigs: Record<string, MCPToolsConfigItem>;
  /** 当前正在编辑的工具参数详情 */
  mcpDetailsEditing: Record<
    string,
    Record<string, string | number | boolean | null>
  >;

  // 原始快照
  originalMcpToolsConfigs: Record<string, MCPToolsConfigItem>;
  originalMcpDetails: Record<
    string,
    Record<string, string | number | boolean | null>
  >;

  // Dialog
  mcpToolDialogOpen: boolean;
  mcpToolDialogType: McpServiceType;

  // 派生
  mcpToolOptions: McpToolInfo[];
  currentDialogMcpToolId: string;
  selectedMcpToolInfo: McpToolInfo | null;

  // setters / actions
  setMcpToolDialogOpen: (open: boolean) => void;
  openMcpToolDialog: (type: McpServiceType) => void;
  handleSelectMcpTool: (toolId: string) => void;
  handleClearMcpTool: (type: McpServiceType) => void;
  updateMcpDetailValue: (
    configKey: string,
    mcpParamName: string,
    value: string | number | boolean | null,
  ) => void;
  renameMcpDetailKey: (
    configKey: string,
    oldName: string,
    newName: string,
  ) => void;
  addMcpDetailRow: (configKey: string) => void;
  removeMcpDetailRow: (configKey: string, mcpParamName: string) => void;

  getMcpToolParams: (toolId: string) => string[];

  refresh: () => Promise<void>;
  /** 保存成功后刷新快照 */
  markSaved: (
    nextTools: Record<string, MCPToolsConfigItem>,
    nextDetails: Record<
      string,
      Record<string, string | number | boolean | null>
    >,
  ) => void;
}

type McpDetailsMap = Record<
  string,
  Record<string, string | number | boolean | null>
>;

export function useMcpToolsConfig(
  args: UseMcpToolsConfigArgs,
): UseMcpToolsConfigReturn {
  const { mcpToolsConfig, updateConfigValue } = args;

  const [mcpConfigs, setMcpConfigs] = useState<MCPConfig[]>([]);
  const [mcpToolsConfigs, setMcpToolsConfigs] = useState<
    Record<string, MCPToolsConfigItem>
  >({});
  const [mcpDetailsEditing, setMcpDetailsEditing] = useState<McpDetailsMap>({});

  const [originalMcpToolsConfigs, setOriginalMcpToolsConfigs] = useState<
    Record<string, MCPToolsConfigItem>
  >({});
  const [originalMcpDetails, setOriginalMcpDetails] = useState<McpDetailsMap>({});

  const [mcpToolDialogOpen, setMcpToolDialogOpen] = useState(false);
  const [mcpToolDialogType, setMcpToolDialogType] =
    useState<McpServiceType>('websearch');

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------
  const fetchMcpConfigs = useCallback(async () => {
    try {
      const data = await mcpConfigApi.getList();
      setMcpConfigs(data.configs);
    } catch (error) {
      console.error('Failed to fetch MCP configs:', error);
    }
    try {
      const toolsConfigData = await mcpConfigApi.getToolsConfigList();
      const configMap: Record<string, MCPToolsConfigItem> = {};
      for (const item of toolsConfigData.items) {
        configMap[item.key] = item;
      }
      setMcpToolsConfigs(configMap);
      const detailsMap: McpDetailsMap = {};
      for (const item of toolsConfigData.items) {
        detailsMap[item.key] = { ...item.details };
      }
      setMcpDetailsEditing(detailsMap);
      setOriginalMcpToolsConfigs(JSON.parse(JSON.stringify(configMap)));
      setOriginalMcpDetails(JSON.parse(JSON.stringify(detailsMap)));
    } catch (error) {
      console.error('Failed to fetch MCP tools config:', error);
    }
  }, []);

  useEffect(() => {
    fetchMcpConfigs();
  }, [fetchMcpConfigs]);

  // -------------------------------------------------------------------------
  // 派生
  // -------------------------------------------------------------------------
  const mcpToolOptions: McpToolInfo[] = useMemo(() => {
    const options: McpToolInfo[] = [];
    for (const config of mcpConfigs) {
      for (const tool of config.tools) {
        options.push({
          value: `${config.config_id} - ${tool.name}`,
          label: `${config.name} / ${tool.name}`,
          description: tool.description || '',
          serverName: config.name,
          toolName: tool.name,
        });
      }
    }
    return options;
  }, [mcpConfigs]);

  const getMcpToolIdByType = useCallback(
    (type: McpServiceType): string => {
      const configKey = MCP_SERVICE_TOOLS_CONFIG_KEY_MAP[type];
      return (mcpToolsConfig?.config[configKey]?.value as string) || '';
    },
    [mcpToolsConfig],
  );

  const currentDialogMcpToolId = useMemo(
    () => getMcpToolIdByType(mcpToolDialogType),
    [getMcpToolIdByType, mcpToolDialogType],
  );

  const selectedMcpToolInfo = useMemo(
    () =>
      currentDialogMcpToolId
        ? mcpToolOptions.find((opt) => opt.value === currentDialogMcpToolId) ||
          null
        : null,
    [currentDialogMcpToolId, mcpToolOptions],
  );

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const getMcpToolParams = useCallback(
    (toolId: string): string[] => {
      if (!toolId) return [];
      const parts = toolId.split(' - ');
      if (parts.length < 2) return [];
      const [, ...toolNameParts] = parts;
      const toolName = toolNameParts.join(' - ');
      const configId = parts[0];
      const config = mcpConfigs.find((c) => c.config_id === configId);
      if (!config) return [];
      const tool = config.tools.find((t) => t.name === toolName);
      if (!tool || !tool.parameters) return [];
      return Object.keys(tool.parameters);
    },
    [mcpConfigs],
  );

  const openMcpToolDialog = useCallback((type: McpServiceType) => {
    setMcpToolDialogType(type);
    setMcpToolDialogOpen(true);
  }, []);

  const handleSelectMcpTool = useCallback(
    (toolId: string) => {
      if (!mcpToolsConfig) return;
      const configKey = MCP_SERVICE_TOOLS_CONFIG_KEY_MAP[mcpToolDialogType];
      const mcpToolsConfigKey = configKey;
      const currentToolId =
        (mcpToolsConfig.config[configKey]?.value as string) || '';
      const finalValue = currentToolId === toolId ? '' : toolId;

      updateConfigValue(mcpToolsConfig.id, configKey, finalValue);

      if (finalValue) {
        const paramNames = getMcpToolParams(finalValue);
        const autoDetails: Record<string, string> = {};
        for (const paramName of paramNames) {
          autoDetails[paramName] = `params - ${paramName}`;
        }
        setMcpToolsConfigs((prev) => ({
          ...prev,
          [mcpToolsConfigKey]: {
            ...prev[mcpToolsConfigKey],
            key: mcpToolsConfigKey,
            data: finalValue,
            details: autoDetails,
          } as MCPToolsConfigItem,
        }));
        setMcpDetailsEditing((prev) => ({
          ...prev,
          [mcpToolsConfigKey]: { ...autoDetails },
        }));
      } else {
        setMcpToolsConfigs((prev) => ({
          ...prev,
          [mcpToolsConfigKey]: {
            ...prev[mcpToolsConfigKey],
            key: mcpToolsConfigKey,
            data: '',
            details: {},
          } as MCPToolsConfigItem,
        }));
        setMcpDetailsEditing((prev) => ({
          ...prev,
          [mcpToolsConfigKey]: {},
        }));
      }

      setMcpToolDialogOpen(false);
    },
    [mcpToolsConfig, mcpToolDialogType, updateConfigValue, getMcpToolParams],
  );

  const handleClearMcpTool = useCallback(
    (type: McpServiceType) => {
      if (!mcpToolsConfig) return;
      const configKey = MCP_SERVICE_TOOLS_CONFIG_KEY_MAP[type];
      updateConfigValue(mcpToolsConfig.id, configKey, '');

      setMcpToolsConfigs((prev) => ({
        ...prev,
        [configKey]: {
          ...prev[configKey],
          key: configKey,
          data: '',
          details: {},
        } as MCPToolsConfigItem,
      }));
      setMcpDetailsEditing((prev) => ({
        ...prev,
        [configKey]: {},
      }));
    },
    [mcpToolsConfig, updateConfigValue],
  );

  const updateMcpDetailValue = useCallback(
    (
      configKey: string,
      mcpParamName: string,
      value: string | number | boolean | null,
    ) => {
      setMcpDetailsEditing((prev) => ({
        ...prev,
        [configKey]: {
          ...prev[configKey],
          [mcpParamName]: value,
        },
      }));
    },
    [],
  );

  const renameMcpDetailKey = useCallback(
    (configKey: string, oldName: string, newName: string) => {
      setMcpDetailsEditing((prev) => {
        const details = { ...prev[configKey] };
        const val = details[oldName];
        delete details[oldName];
        details[newName] = val;
        return { ...prev, [configKey]: details };
      });
    },
    [],
  );

  const addMcpDetailRow = useCallback((configKey: string) => {
    setMcpDetailsEditing((prev) => ({
      ...prev,
      [configKey]: {
        ...prev[configKey],
        '': 'params - ',
      },
    }));
  }, []);

  const removeMcpDetailRow = useCallback(
    (configKey: string, mcpParamName: string) => {
      setMcpDetailsEditing((prev) => {
        const newDetails = { ...prev[configKey] };
        delete newDetails[mcpParamName];
        return {
          ...prev,
          [configKey]: newDetails,
        };
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    await fetchMcpConfigs();
  }, [fetchMcpConfigs]);

  const markSaved = useCallback(
    (
      nextTools: Record<string, MCPToolsConfigItem>,
      nextDetails: McpDetailsMap,
    ) => {
      setOriginalMcpToolsConfigs(JSON.parse(JSON.stringify(nextTools)));
      setOriginalMcpDetails(JSON.parse(JSON.stringify(nextDetails)));
    },
    [],
  );

  return {
    mcpConfigs,
    mcpToolsConfigs,
    mcpDetailsEditing,
    originalMcpToolsConfigs,
    originalMcpDetails,
    mcpToolDialogOpen,
    mcpToolDialogType,
    mcpToolOptions,
    currentDialogMcpToolId,
    selectedMcpToolInfo,
    setMcpToolDialogOpen,
    openMcpToolDialog,
    handleSelectMcpTool,
    handleClearMcpTool,
    updateMcpDetailValue,
    renameMcpDetailKey,
    addMcpDetailRow,
    removeMcpDetailRow,
    getMcpToolParams,
    refresh,
    markSaved,
  };
}
