import { Lock } from 'lucide-react';
import { ja } from '@/i18n/ja';
import { StatusPage } from './StatusPage';

export function ForbiddenPage() {
  return (
    <StatusPage
      title={ja.system.forbiddenTitle}
      icon={<Lock aria-hidden="true" className="size-10" />}
    />
  );
}
