import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-ink-sub">
      <span>
        {total}件中 {from}〜{to}件
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="前のページ"
          icon={<ChevronLeft className="size-4" aria-hidden="true" />}
        />
        <span className="px-2">
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="次のページ"
          icon={<ChevronRight className="size-4" aria-hidden="true" />}
        />
      </div>
    </div>
  );
}
