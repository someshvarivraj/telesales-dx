import { ja } from '@/i18n/ja';
import { StatusPage } from './StatusPage';

export function ForbiddenPage() {
  return <StatusPage title={ja.system.forbiddenTitle} mood="explain" />;
}
