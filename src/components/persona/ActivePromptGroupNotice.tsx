import { AlertCircle, ScrollText } from 'lucide-react';

import type { ActivePromptGroupLine } from '@/components/persona/activePromptGroups';
import { GlassAlert } from '@/components/ui/glass-alert';
import { useLanguage } from '@/contexts/LanguageContext';

export function ActivePromptGroupNotice({
  lines,
  ready,
}: {
  lines: ActivePromptGroupLine[];
  ready: boolean;
}) {
  const { t } = useLanguage();
  if (!ready) return null;
  const sep = t('personaConfig.activePromptGroupSep');
  const empty = lines.length === 0;
  const text = empty
    ? t('personaConfig.activePromptGroupEmpty')
    : t('personaConfig.activePromptGroups', {
        summary: lines
          .map((line) =>
            t('personaConfig.activePromptGroupItem', {
              group: line.group,
              names: line.names.join(sep),
            }),
          )
          .join(sep),
      });
  return (
    <GlassAlert tone={empty ? 'warning' : 'info'} icon={empty ? AlertCircle : ScrollText}>
      {text}
    </GlassAlert>
  );
}
