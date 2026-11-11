import type { ReactNode } from 'react';
import { cn } from './cn';

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  /** Span both columns (long text). */
  wide?: boolean;
}

const isEmpty = (value: ReactNode) => value === null || value === undefined || value === '';

/**
 * In the two-pair layout a value stretches to the end of its row when the next item is wide
 * (or there is none), so no row is left with an empty half.
 */
function layOut(items: readonly DescriptionItem[]) {
  const cells: { item: DescriptionItem; stretch: boolean }[] = [];
  let column = 0;
  items.forEach((item, index) => {
    const next = items[index + 1];
    const wide = Boolean(item.wide);
    const fillsRow = wide || column === 1 || !next || Boolean(next.wide);
    cells.push({ item, stretch: wide || (column === 0 && fillsRow) });
    column = fillsRow ? 0 : 1;
  });
  return cells;
}

/**
 * Label / value pairs as a ruled form, like a printed 帳票 (feedback 11/11: labels and
 * values must be told apart at a glance). The label sits in a shaded cell, the value
 * beside it in bold; two pairs per row when the box is wide enough, one when it is not
 * (it follows the box, not the screen, so it also works in a side column or a dialog).
 */
export function DescriptionList({ items }: { items: readonly DescriptionItem[] }) {
  const cells = layOut(items);

  return (
    <div className="@container">
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] border-t border-l border-line @sm:grid-cols-[7.5rem_minmax(0,1fr)] @xl:grid-cols-[8.5rem_minmax(0,1fr)_8.5rem_minmax(0,1fr)]">
        {cells.map(({ item, stretch }) => (
          <div key={item.label} className="contents">
            <dt className="flex items-start border-r border-b border-line bg-canvas px-2.5 py-2.5 text-xs leading-5 font-bold text-ink-sub @sm:px-3">
              {item.label}
            </dt>
            <dd
              className={cn(
                'min-w-0 border-r border-b border-line px-2.5 py-2.5 text-sm @sm:px-3 leading-5 break-words whitespace-pre-wrap',
                stretch && '@xl:col-span-3',
                isEmpty(item.value) ? 'text-ink-disabled' : 'font-medium text-ink',
              )}
            >
              {isEmpty(item.value) ? '―' : item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
