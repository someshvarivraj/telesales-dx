import { ja } from '@/i18n/ja';
import { StatusPage } from './StatusPage';

export function NotFoundPage() {
  return <StatusPage title={ja.system.notFoundTitle} description={ja.system.notFoundBody} />;
}
