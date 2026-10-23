import type { ReactNode } from 'react';
import { ja } from '@/i18n/ja';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { Alert } from './Alert';
import { MoraBot } from '@/components/brand/MoraBot';

interface QueryStateProps<T> {
  query: { data: T | undefined; isPending: boolean; isError: boolean; error: unknown };
  children: (data: T) => ReactNode;
}

/** Loading / error / data for one query, so pages do not repeat the same branches. */
export function QueryState<T>({ query, children }: QueryStateProps<T>) {
  if (query.isPending) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-sub"
      >
        <MoraBot mood="think" size={80} animate title="" />
        {ja.common.loading}
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return <Alert tone="error">{errorMessageOf(query.error)}</Alert>;
  }
  return <>{children(query.data)}</>;
}
