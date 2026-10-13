import { Construction } from 'lucide-react';
import { ja } from '@/i18n/ja';
import { StatusPage } from './StatusPage';

/** Route target for modules that are not built yet. Replace per module as it is implemented. */
export function ModulePlaceholderPage({ title }: { title: string }) {
  return (
    <StatusPage
      title={title}
      description={ja.common.comingSoon}
      icon={<Construction aria-hidden="true" className="size-10" />}
    />
  );
}
