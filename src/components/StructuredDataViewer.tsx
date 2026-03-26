
import React, { memo, useMemo } from 'react';

interface StructuredDataViewerProps {
  data: string;
  className?: string;
}

// 预编译的正则表达式
const HAS_STRUCTURE_REGEX = /[\{\[\(]/;
const TRIMMED_EMPTY_REGEX = /^\s*$/;

// 缓存颜色配置
const colors = {
  key: 'text-red-600 dark:text-red-400 font-semibold',
  string: 'text-green-600 dark:text-green-400',
  number: 'text-blue-600 dark:text-blue-400',
  boolean: 'text-purple-600 dark:text-purple-400',
  null: 'text-gray-500',
  bracket: 'text-gray-500',
  className: 'text-cyan-600 dark:text-cyan-400 font-semibold',
  normal: 'text-gray-700 dark:text-gray-300',
  text: 'text-sky-500 dark:text-sky-400 font-medium'
};

// 简单的纯文本渲染 - 无需任何解析
const PlainText = memo(function PlainText({ text }: { text: string }) {
  return <span className={colors.text}>{text}</span>;
});

// 尝试解析JSON - 使用缓存避免重复解析
const tryParseJSON = (str: string): object | null => {
  try {
    // 先处理常见的格式
    let cleaned = str
      .replace(/(\w+)\(([\s\S]*?)\)/g, (_, className, args) => {
        const processedArgs = args.replace(/(\w+)=/g, '"$1": ');
        return `{"__class__":"${className}","args":{${processedArgs}}}`;
      })
      .replace(/'/g, '"')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false');
    
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

// 简化的渲染器 - 避免递归创建太多DOM节点
const SimpleRenderer = memo(function SimpleRenderer({ obj, depth = 0 }: { obj: any; depth?: number }) {
  // 深度限制 - 防止过度嵌套
  if (depth > 3) {
    return <span className="text-gray-400">...</span>;
  }

  if (obj === null || obj === undefined) {
    return <span className={colors.null}>null</span>;
  }

  if (typeof obj === 'boolean') {
    return <span className={colors.boolean}>{obj.toString()}</span>;
  }

  if (typeof obj === 'number') {
    return <span className={colors.number}>{obj}</span>;
  }

  if (typeof obj === 'string') {
    return <span className={colors.string}>"{obj}"</span>;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return <span className={colors.bracket}>[]</span>;
    }
    // 限制数组显示前5项
    const displayItems = obj.slice(0, 5);
    const hasMore = obj.length > 5;
    return (
      <span className={colors.bracket}>
        [
        {displayItems.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className={colors.bracket}>, </span>}
            <SimpleRenderer obj={item} depth={depth + 1} />
          </React.Fragment>
        ))}
        {hasMore && <span className="text-gray-400">...+{obj.length - 5}</span>}
        <span className={colors.bracket}>]</span>
      </span>
    );
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return <span className={colors.bracket}>{'{}'}</span>;
    }

    // ClassWrapper格式
    if (keys.length === 2 && '__class__' in obj && 'args' in obj) {
      const className = obj.__class__;
      const args = obj.args;
      if (typeof args !== 'object' || args === null) {
        return <span><span className={colors.className}>{className}</span><span className={colors.bracket}>({String(args)})</span></span>;
      }
      const argKeys = Object.keys(args).slice(0, 3); // 只显示前3个参数
      const hasMore = Object.keys(args).length > 3;
      return (
        <span>
          <span className={colors.className}>{className}</span>
          <span className={colors.bracket}>(</span>
          {argKeys.map((key, i) => (
            <React.Fragment key={key}>
              {i > 0 && <span className={colors.bracket}>, </span>}
              <span className={colors.key}>{key}</span>
              <span className={colors.bracket}>:</span>
              <SimpleRenderer obj={args[key]} depth={depth + 1} />
            </React.Fragment>
          ))}
          {hasMore && <span className="text-gray-400">...</span>}
          <span className={colors.bracket}>)</span>
        </span>
      );
    }

    // 普通对象 - 只显示前4个键
    const displayKeys = keys.slice(0, 4);
    const hasMore = keys.length > 4;
    return (
      <span className={colors.bracket}>
        {'{'}{displayKeys.map((key, i) => (
          <React.Fragment key={key}>
            {i > 0 && <span className={colors.bracket}>, </span>}
            <span className={colors.key}>"{key}"</span>
            <span className={colors.bracket}>:</span>
            <SimpleRenderer obj={obj[key]} depth={depth + 1} />
          </React.Fragment>
        ))}{hasMore && <span className="text-gray-400">...</span>}{'}'}
      </span>
    );
  }

  return <span>{String(obj)}</span>;
});

// 主组件
const StructuredDataViewer = memo(function StructuredDataViewer({ data, className = '' }: StructuredDataViewerProps) {
  // 如果没有结构化数据，直接显示纯文本
  if (!data || !HAS_STRUCTURE_REGEX.test(data)) {
    return <span className={className}>{data}</span>;
  }

  // 尝试解析JSON
  const parsed = useMemo(() => tryParseJSON(data), [data]);

  // 如果解析成功，渲染结构化视图
  if (parsed) {
    return (
      <span className={className}>
        <SimpleRenderer obj={parsed} />
      </span>
    );
  }

  // 解析失败，显示纯文本
  return <span className={className}>{data}</span>;
});

export { StructuredDataViewer };
export default StructuredDataViewer;
