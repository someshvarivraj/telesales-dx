import type { ReactNode } from 'react';

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  /** Span both columns (long text). */
  wide?: boolean;
}

/** Label / value pairs; two columns on wide screens. */
export function DescriptionList({ items }: { items: readonly DescriptionItem[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className={item.wide ? 'sm:col-span-2' : undefined}>
          <dt className="text-xs font-bold text-ink-sub">{item.label}</dt>
          <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap text-ink">
            {item.value === null || item.value === undefined || item.value === '' ? (
              <span className="text-ink-disabled">―</span>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
