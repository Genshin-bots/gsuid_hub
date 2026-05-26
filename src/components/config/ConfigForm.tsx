import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfigField, ConfigFieldDefinition, ConfigValue } from './ConfigField';
import { Save, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ConfigFormData {
  [key: string]: ConfigFieldDefinition;
}

interface ConfigFormProps {
  title: string;
  description?: string;
  warningMessage?: string;
  config: ConfigFormData;
  initialConfig?: ConfigFormData;
  onSave?: (config: ConfigFormData) => void | Promise<void>;
  onReset?: () => void;
  columns?: 1 | 2 | 3 | 4;
  showActions?: boolean;
  className?: string;
}

export function ConfigForm({
  title,
  description,
  warningMessage,
  config: initialConfigProp,
  initialConfig,
  onSave,
  onReset,
  columns = 3,
  showActions = true,
  className,
}: ConfigFormProps) {
  const [config, setConfig] = useState<ConfigFormData>(initialConfigProp);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = useCallback((key: string, value: ConfigValue) => {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(config);
        toast.success('配置已成功保存');
        setHasChanges(false);
      } catch (error) {
        toast.error('保存配置时发生错误');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleReset = () => {
    if (initialConfig) {
      setConfig(initialConfig);
    } else {
      setConfig(initialConfigProp);
    }
    setHasChanges(false);
    onReset?.();
    toast.success('配置已恢复');
  };

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <Card className={cn("glass-card", className)}>
      {(title || description || warningMessage) && (
        <CardHeader>
          {warningMessage && (
            <Alert variant="destructive" className="mb-4 border-orange-500/50 bg-orange-500/10">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-600 dark:text-orange-400">
                {warningMessage}
              </AlertDescription>
            </Alert>
          )}
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      
      <CardContent className="space-y-6">
        <div className={cn("grid gap-6", gridCols[columns])}>
          {Object.entries(config).map(([key, field]) => (
            <ConfigField
              key={key}
              fieldKey={key}
              field={field}
              onChange={handleChange}
            />
          ))}
        </div>

        {showActions && (
          <div className="flex items-center justify-center pt-4 border-t border-border">
            <Button 
              onClick={handleSave} 
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              确认修改
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Standalone config grid for use without Card wrapper
interface ConfigGridProps {
  config: ConfigFormData;
  onChange: (key: string, value: ConfigValue) => void;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function ConfigGrid({ config, onChange, columns = 3, className }: ConfigGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn("grid gap-6", gridCols[columns], className)}>
      {Object.entries(config).map(([key, field]) => (
        <ConfigField
          key={key}
          fieldKey={key}
          field={field}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
