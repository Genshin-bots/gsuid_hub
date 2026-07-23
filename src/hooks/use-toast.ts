/**
 * Toast hook compatibility layer.
 *
 * The console UI standardizes on `sonner` (`import { toast } from 'sonner'`).
 * This module keeps the historical `@/hooks/use-toast` / `@/components/ui/use-toast`
 * import path working for any leftover shadcn-style callers.
 */
import { toast as sonnerToast } from 'sonner';

type ToastProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
};

function toast(props: ToastProps | string) {
  if (typeof props === 'string') {
    return sonnerToast(props);
  }
  const { title, description, variant, duration } = props;
  const message = title ?? description ?? '';
  const opts = {
    description: title ? description : undefined,
    duration,
  };
  if (variant === 'destructive') {
    return sonnerToast.error(message, opts);
  }
  return sonnerToast(message, opts);
}

function useToast() {
  return {
    toast,
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  };
}

export { useToast, toast };
