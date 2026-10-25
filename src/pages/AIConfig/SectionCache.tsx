import type { ReactNode } from 'react';
import { FieldMountBudget } from '@/components/config/fieldMountBudget';
import { KeptPane } from '@/components/ui/KeptPane';

/** AI 配置页签：先画出选中态，字段按帧挂，空闲时预挂还没点过的页。 */
export function SectionCache({
  active,
  version,
  render,
}: {
  active: boolean;
  version: unknown;
  render: () => ReactNode;
}) {
  return (
    <KeptPane
      active={active}
      version={version}
      preload
      holdPreload
      render={render}
      wrap={(node, release) => (
        <FieldMountBudget foreground={active} onDrained={release}>
          {node}
        </FieldMountBudget>
      )}
    />
  );
}
