import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TagsInput } from '@/components/config/TagsInput';
import {
  Tag,
  AlignLeft,
  BookOpen,
  HelpCircle
} from 'lucide-react';

interface FormField {
  key: string;
  label: string;
  icon?: React.ElementType;
  required?: boolean;
  type: 'input' | 'textarea' | 'tags' | 'readonly';
  placeholder?: string;
  helpText?: string;
  rows?: number;
}

interface FormSection {
  title?: string;
  icon?: React.ElementType;
  fields: FormField[];
}

// 知识库表单字段配置
export const knowledgeFormSections: FormSection[] = [
  {
    fields: [
      { key: 'title', label: 'aiKnowledge.titleField', icon: BookOpen, required: true, type: 'input', placeholder: 'aiKnowledge.titlePlaceholder' },
    ]
  },
  {
    fields: [
      { key: 'plugin', label: 'aiKnowledge.plugin', icon: Tag, required: true, type: 'input', placeholder: 'manual' },
    ]
  },
  {
    fields: [
      { key: 'tags', label: 'aiKnowledge.tags', icon: Tag, type: 'tags', placeholder: 'aiKnowledge.tagsPlaceholder' },
    ]
  },
  {
    fields: [
      { key: 'content', label: 'aiKnowledge.content', icon: AlignLeft, required: true, type: 'textarea', placeholder: 'aiKnowledge.contentPlaceholder', rows: 6 },
    ]
  },
];

interface FormCardProps {
  type: 'knowledge';
  mode: 'edit' | 'view';
  data: Record<string, any>;
  onChange?: (key: string, value: any) => void;
  showId?: boolean;
}

export function FormCard({ type, mode, data, onChange, showId = false }: FormCardProps) {
  const { t } = useLanguage();
  const allSections = knowledgeFormSections;
  // 根据 showId 过滤 sections
  const sections = allSections.map(section => ({
    ...section,
    fields: section.fields.filter(f => f.key !== 'id' || showId)
  }));
  const renderField = (field: FormField, value: any, dataId?: string) => {
    const handleChange = (newValue: any) => {
      if (onChange) {
        onChange(field.key, newValue);
      }
    };

    // 只读字段或预览模式
    if (mode === 'view' || field.type === 'readonly') {
      if (field.type === 'tags' || field.key === 'tags') {
        const tags = Array.isArray(value) ? value : [];
        if (tags.length === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <Badge key={i} variant="outline">{tag}</Badge>
            ))}
          </div>
        );
      }
      if (field.type === 'textarea' || field.key === 'content') {
        return (
          <div className="bg-muted rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {value || '-'}
            </pre>
          </div>
        );
      }
      if (field.key === 'plugin') {
        return <Badge variant="secondary">{value || '-'}</Badge>;
      }
      if (field.type === 'readonly') {
        return <p className="text-sm text-muted-foreground">{value || '-'}</p>;
      }
      return <p className="text-sm">{value || '-'}</p>;
    }

    // 编辑模式
    if (field.type === 'tags') {
      return (
        <TagsInput
          value={Array.isArray(value) ? value : []}
          onChange={handleChange}
          placeholder={t(field.placeholder || '')}
        />
      );
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t(field.placeholder || '')}
          rows={field.rows || 6}
          className="font-mono text-sm bg-secondary/30 border border-border/50"
        />
      );
    }

    return (
      <Input
        value={value || ''}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t(field.placeholder || '')}
        disabled={field.key === 'plugin' && type === 'knowledge'}
        className="bg-secondary/30 border border-border/50"
      />
    );
  };

  return (
    <div className="space-y-4">
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="space-y-3">
          {section.fields.map((field, fieldIndex) => {
            const isFirstInSection = fieldIndex === 0;
            const showSeparator = isFirstInSection && sectionIndex > 0;
            
            return (
              <div key={field.key}>
                {showSeparator && <Separator className="my-4" />}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    {field.icon && React.createElement(field.icon, { className: "w-4 h-4" })}
                    {t(field.label)}
                    {field.required && <span className="text-destructive">*</span>}
                    {field.helpText && mode === 'edit' && (
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help ml-1" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          sideOffset={8}
                          align="center"
                          className="max-w-xs z-50"
                          avoidCollisions={true}
                        >
                          <p className="text-sm">{t(field.helpText)}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  {renderField(field, data[field.key], data.id)}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// 详情 Dialog 头部组件
interface DetailHeaderProps {
  title: string;
  type: 'knowledge';
  subtitle?: string;
}

export function DetailHeader({ title, type, subtitle }: DetailHeaderProps) {
  const icon = BookOpen;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {React.createElement(icon, { className: "w-5 h-5 text-primary" })}
        <span className="text-lg font-semibold">{title}</span>
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground pl-8">{subtitle}</p>
      )}
    </div>
  );
}
