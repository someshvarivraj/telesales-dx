import { SearchX } from 'lucide-react';
import { ja } from '@/i18n/ja';
import { StatusPage } from './StatusPage';

export function NotFoundPage() {
  return (
    <StatusPage
      title={ja.system.notFoundTitle}
      description={ja.system.notFoundBody}
      icon={<SearchX aria-hidden="true" className="size-10" />}
    />
  );
}
