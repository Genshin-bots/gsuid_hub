import { useEffect, useState, type CSSProperties } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

function supportsWebkitTextSecurity(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.createElement('input');
  el.style.setProperty('-webkit-text-security', 'disc');
  return el.style.getPropertyValue('-webkit-text-security') === 'disc';
}

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * 配置密钥输入：视觉上可隐藏，但不用 type="password"。
 * Chrome 会把 password 控件当成登录框并自动填充；配置页不需要这套行为。
 */
export function SecretInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
}: SecretInputProps) {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [textSecurityOk, setTextSecurityOk] = useState(true);

  useEffect(() => {
    setTextSecurityOk(supportsWebkitTextSecurity());
  }, []);

  const hideVisually = !show;
  const usePasswordFallback = hideVisually && !textSecurityOk;

  return (
    <div className="relative">
      <Input
        id={id}
        type={usePasswordFallback ? 'password' : 'text'}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        data-bwignore="true"
        onFocus={() => setReadOnly(false)}
        onChange={(e) => onChange(e.target.value)}
        className={cn('bg-background h-10 pr-10', className)}
        style={
          hideVisually && textSecurityOk
            ? ({ WebkitTextSecurity: 'disc' } as CSSProperties)
            : undefined
        }
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={show ? t('common.hide') : t('common.show')}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
