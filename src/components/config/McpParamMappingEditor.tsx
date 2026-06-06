import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type McpServiceType = 'websearch' | 'image_understand' | 'asr' | 'document_extract' | 'video_extract' | 'video_understand';

type MappingType = 'dynamic' | 'fixed' | 'skip';

export interface InternalParamDef {
  name: string;
  type: string;
  descKey: string;
}

export interface McpParamMappingEditorProps {
  /** MCP tools config key, e.g. 'websearch_mcp_tool_id' */
  configKey: string;
  /** Current details mapping state */
  details: Record<string, string | number | boolean | null>;
  /** Callback when a detail value changes */
  onDetailValueChange: (mcpParamName: string, value: string | number | boolean | null) => void;
  /** Callback when MCP param name is renamed */
  onMcpParamNameChange: (oldName: string, newName: string) => void;
  /** Callback to add a new row */
  onAddRow: () => void;
  /** Callback to remove a row */
  onRemoveRow: (mcpParamName: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Map from MCP service type to MCP tools config key */
export const MCP_SERVICE_TOOLS_CONFIG_KEY_MAP: Record<McpServiceType, string> = {
  websearch: 'websearch_mcp_tool_id',
  image_understand: 'image_understand_mcp_tool_id',
  asr: 'asr_mcp_tool_id',
  document_extract: 'document_extract_mcp_tool_id',
  video_extract: 'video_extract_mcp_tool_id',
  video_understand: 'video_understand_mcp_tool_id',
};

/** Map from config key to available internal params for dropdown */
export const MCP_INTERNAL_PARAMS_MAP: Record<string, InternalParamDef[]> = {
  websearch_mcp_tool_id: [
    { name: 'query', type: 'string', descKey: 'aiConfig.mcpTool.internalParam.query' },
    { name: 'max_results', type: 'int', descKey: 'aiConfig.mcpTool.internalParam.max_results' },
  ],
  image_understand_mcp_tool_id: [
    { name: 'image_source', type: 'string', descKey: 'aiConfig.mcpTool.internalParam.image_source' },
    { name: 'prompt', type: 'string', descKey: 'aiConfig.mcpTool.internalParam.prompt' },
  ],
  asr_mcp_tool_id: [
    { name: 'audio_source', type: 'string', descKey: 'aiConfig.mcpTool.internalParam.audio_source' },
    { name: 'language', type: 'string | null', descKey: 'aiConfig.mcpTool.internalParam.language' },
  ],
  document_extract_mcp_tool_id: [
    { name: 'file_source', type: 'string', descKey: 'aiConfig.mcpTool.internalParam.file_source' },
    { name: 'page_range', type: 'string | null', descKey: 'aiConfig.mcpTool.internalParam.page_range' },
  ],
  video_extract_mcp_tool_id: [
    { name: 'video_source', type: 'string', descKey: 'aiConfig.mcpTool.internalParam.video_source' },
    { name: 'max_frames', type: 'int', descKey: 'aiConfig.mcpTool.internalParam.max_frames' },
    { name: 'interval_seconds', type: 'float | null', descKey: 'aiConfig.mcpTool.internalParam.interval_seconds' },
  ],
  video_understand_mcp_tool_id: [
    { name: 'video_source', type: 'string', descKey: 'aiConfig.mcpTool.internalParam.video_source' },
    { name: 'prompt', type: 'string', descKey: 'aiConfig.mcpTool.internalParam.prompt' },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

const PARAMS_PREFIX = 'params - ';
const NONE_VALUE = '__none__';

/**
 * Parse a detail value to determine its mapping type.
 * - "params - X" → dynamic, paramName = X
 * - null/undefined → skip
 * - anything else → fixed, fixedValue = String(value)
 */
function parseDetailValue(value: string | number | boolean | null): {
  type: MappingType;
  paramName: string;
  fixedValue: string;
} {
  if (value === null || value === undefined) {
    return { type: 'skip', paramName: '', fixedValue: '' };
  }
  if (typeof value === 'string' && value.startsWith(PARAMS_PREFIX)) {
    return { type: 'dynamic', paramName: value.slice(PARAMS_PREFIX.length), fixedValue: '' };
  }
  return { type: 'fixed', paramName: '', fixedValue: String(value) };
}

// ============================================================================
// Sub-component: McpParamMappingRow
// ============================================================================

interface McpParamMappingRowProps {
  mcpParamName: string;
  mappingValue: string | number | boolean | null;
  availableInternalParams: InternalParamDef[];
  onMcpParamNameChange: (oldName: string, newName: string) => void;
  onValueChange: (value: string | number | boolean | null) => void;
  onRemove: () => void;
}

function McpParamMappingRow({
  mcpParamName,
  mappingValue,
  availableInternalParams,
  onMcpParamNameChange,
  onValueChange,
  onRemove,
}: McpParamMappingRowProps) {
  const { t } = useLanguage();
  const parsed = parseDetailValue(mappingValue);
  const mode = parsed.type;
  const internalParamName = parsed.paramName;
  const fixedVal = parsed.fixedValue;

  const isKnownInternalParam = availableInternalParams.some(p => p.name === internalParamName);

  const handleModeChange = (newMode: string) => {
    if (newMode === 'dynamic') {
      const paramName = internalParamName || availableInternalParams[0]?.name || '';
      onValueChange(paramName ? `${PARAMS_PREFIX}${paramName}` : '');
    } else if (newMode === 'fixed') {
      onValueChange(fixedVal || '');
    } else {
      onValueChange(null);
    }
  };

  const handleInternalParamSelect = (val: string) => {
    if (val !== NONE_VALUE) {
      onValueChange(`${PARAMS_PREFIX}${val}`);
    }
  };

  // Build select items for internal param dropdown
  const selectItems = useMemo(() => {
    const items: { value: string; label: string; type: string; isCustom?: boolean }[] = [];

    // Add custom item if current param is not in known list
    if (internalParamName && !isKnownInternalParam) {
      items.push({
        value: internalParamName,
        label: internalParamName,
        type: '?',
        isCustom: true,
      });
    }

    // Add known internal params
    for (const p of availableInternalParams) {
      items.push({
        value: p.name,
        label: p.name,
        type: p.type,
      });
    }

    return items;
  }, [internalParamName, isKnownInternalParam, availableInternalParams]);

  // Select value: use internal param name, or __none__ placeholder if empty
  const selectValue = internalParamName || NONE_VALUE;

  return (
    <div className={cn(
      'flex items-center gap-1.5',
      mode === 'skip' && 'opacity-50'
    )}>
      {/* MCP 参数名：已有值时不可编辑（MCP 工具要求的参数名），新增空行时可输入 */}
      {mcpParamName ? (
        <span
          className={cn(
            'h-7 px-2 text-xs font-mono rounded-md border border-border/30 bg-muted/30 flex items-center shrink-0 w-[120px] truncate',
            mode === 'skip' && 'line-through'
          )}
          title={mcpParamName}
        >
          {mcpParamName}
        </span>
      ) : (
        <Input
          className="h-7 text-xs font-mono w-[120px] shrink-0 bg-background/80"
          value={mcpParamName}
          placeholder={t('aiConfig.mcpTool.mcpParamName')}
          onChange={e => onMcpParamNameChange(mcpParamName, e.target.value)}
          autoFocus
        />
      )}
      <span className="text-xs text-muted-foreground shrink-0">←</span>

      {/* 映射类型选择 */}
      <Select value={mode} onValueChange={handleModeChange}>
        <SelectTrigger
          style={{ width: 120 }}
          className={cn(
            'h-7 text-xs shrink-0',
          mode === 'dynamic' && 'border-primary/30 text-primary',
          mode === 'fixed' && 'border-border/40',
          mode === 'skip' && 'border-muted-foreground/20 text-muted-foreground'
        )}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dynamic">{t('aiConfig.mcpTool.dynamicMapping')}</SelectItem>
          <SelectItem value="fixed">{t('aiConfig.mcpTool.fixedValue')}</SelectItem>
          <SelectItem value="skip">{t('aiConfig.mcpTool.skipParam')}</SelectItem>
        </SelectContent>
      </Select>

      {/* 值编辑区：根据模式显示不同编辑器 */}
      {mode === 'dynamic' && availableInternalParams.length > 0 && (
        <Select value={selectValue} onValueChange={handleInternalParamSelect}>
          <SelectTrigger className={cn(
            'h-7 flex-1 min-w-0 text-xs',
            internalParamName
              ? 'bg-primary/5 border-primary/20'
              : 'bg-muted/30 border-border/30'
          )}>
            <SelectValue placeholder={t('aiConfig.mcpTool.selectInternalParam')} />
          </SelectTrigger>
          <SelectContent>
            {/* Hidden placeholder item for empty value */}
            <SelectItem value={NONE_VALUE} disabled className="hidden">
              {t('aiConfig.mcpTool.selectInternalParam')}
            </SelectItem>
            {selectItems.map(item => (
              <SelectItem key={item.value} value={item.value}>
                <div className="flex items-center gap-1">
                  <span className="font-mono">{item.label}</span>
                  <span className="text-muted-foreground text-[10px]">({item.type})</span>
                  {item.isCustom && (
                    <Badge variant="outline" className="text-[8px] h-3 px-0.5 border-amber-500/30 text-amber-600 dark:text-amber-400">
                      {t('aiConfig.mcpTool.customParam')}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {mode === 'dynamic' && availableInternalParams.length === 0 && (
        <Input
          className="h-7 text-xs font-mono flex-1 min-w-0 bg-background/80"
          value={internalParamName}
          placeholder={t('aiConfig.mcpTool.customInternalParam')}
          onChange={e => onValueChange(`${PARAMS_PREFIX}${e.target.value}`)}
        />
      )}
      {mode === 'fixed' && (
        <Input
          className="h-7 text-xs font-mono flex-1 min-w-0 bg-background/80"
          value={fixedVal}
          placeholder={t('aiConfig.mcpTool.fixedValuePlaceholder')}
          onChange={e => onValueChange(e.target.value)}
        />
      )}
      {mode === 'skip' && (
        <span className="text-[10px] text-muted-foreground/50 italic flex-1 min-w-0 truncate">
          {t('aiConfig.mcpTool.skipParamDesc')}
        </span>
      )}

      {/* 删除按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component: McpParamMappingEditor
// ============================================================================

export function McpParamMappingEditor({
  configKey,
  details,
  onDetailValueChange,
  onMcpParamNameChange,
  onAddRow,
  onRemoveRow,
}: McpParamMappingEditorProps) {
  const { t } = useLanguage();
  const internalParams = MCP_INTERNAL_PARAMS_MAP[configKey] || [];
  const hasMappings = details && Object.keys(details).length > 0;

  if (!hasMappings) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t('aiConfig.mcpTool.noParamMapping')}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-0.5" onClick={onAddRow}>
          <Plus className="w-3 h-3" />
          {t('aiConfig.mcpTool.addParam')}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">{t('aiConfig.mcpTool.paramMapping')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-0.5" onClick={onAddRow}>
            <Plus className="w-3 h-3" />
            {t('aiConfig.mcpTool.addParam')}
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/70">{t('aiConfig.mcpTool.paramMappingHint')}</p>
      <div className="space-y-1.5">
        {Object.entries(details).map(([mcpParam, mappingValue]) => (
          <McpParamMappingRow
            key={mcpParam}
            mcpParamName={mcpParam}
            mappingValue={mappingValue}
            availableInternalParams={internalParams}
            onMcpParamNameChange={onMcpParamNameChange}
            onValueChange={(value) => onDetailValueChange(mcpParam, value)}
            onRemove={() => onRemoveRow(mcpParam)}
          />
        ))}
      </div>
    </div>
  );
}
