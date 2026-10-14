import { OPTION_CATEGORIES, type OptionCategory, type OptionDto } from '@telesales/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { QueryState } from '@/components/ui/QueryState';
import { cn } from '@/components/ui/cn';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { useAdminOptions, useCreateOption, useUpdateOption } from './api';

const CATEGORY_LABEL: Record<OptionCategory, string> = {
  call_grade: '架電結果の判定',
  customer_type: '取引区分',
  plan_type: '予定の種別',
  interest_level: '乗り気度',
  meeting_response: '打ち合わせの手応え',
  deal_status: '案件ステータス',
};

function OptionRow({
  option,
  onMove,
  first,
  last,
}: {
  option: OptionDto;
  onMove: (direction: -1 | 1) => void;
  first: boolean;
  last: boolean;
}) {
  const update = useUpdateOption();
  const [label, setLabel] = useState(option.label);
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-0',
        !option.isActive && 'opacity-60',
      )}
    >
      <code className="w-24 shrink-0 text-xs text-ink-sub">{option.code}</code>
      <div className="min-w-40 flex-1">
        <TextInput
          aria-label={`${option.code}の名前`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() =>
            label.trim() &&
            label !== option.label &&
            update.mutate({
              id: option.id,
              request: {
                label: label.trim(),
                isActive: option.isActive,
                sortOrder: option.sortOrder,
              },
            })
          }
        />
      </div>
      <Checkbox
        label="使う"
        checked={option.isActive}
        onChange={(e) =>
          update.mutate({
            id: option.id,
            request: {
              label: option.label,
              isActive: e.target.checked,
              sortOrder: option.sortOrder,
            },
          })
        }
      />
      <Button
        variant="text"
        aria-label="上へ"
        disabled={first}
        onClick={() => onMove(-1)}
        icon={<ArrowUp className="size-4" aria-hidden="true" />}
      />
      <Button
        variant="text"
        aria-label="下へ"
        disabled={last}
        onClick={() => onMove(1)}
        icon={<ArrowDown className="size-4" aria-hidden="true" />}
      />
    </li>
  );
}

/** Option lists: admins add and rename; options are disabled, never deleted (spec §5, §12). */
export function OptionsPage() {
  const options = useAdminOptions();
  const create = useCreateOption();
  const update = useUpdateOption();
  const [category, setCategory] = useState<OptionCategory>('call_grade');
  const [draft, setDraft] = useState({ code: '', label: '' });

  return (
    <QueryState query={options}>
      {(all) => {
        const items = all
          .filter((option) => option.category === category)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const move = (index: number, direction: -1 | 1) => {
          const a = items[index];
          const b = items[index + direction];
          if (!a || !b) return;
          update.mutate({
            id: a.id,
            request: { label: a.label, isActive: a.isActive, sortOrder: b.sortOrder },
          });
          update.mutate({
            id: b.id,
            request: { label: b.label, isActive: b.isActive, sortOrder: a.sortOrder },
          });
        };
        return (
          <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
            <nav aria-label="選択肢の種類">
              <ul className="flex flex-col gap-1 max-lg:flex-row max-lg:flex-wrap">
                {OPTION_CATEGORIES.map((value) => (
                  <li key={value}>
                    <button
                      type="button"
                      onClick={() => setCategory(value)}
                      className={cn(
                        'w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-bold',
                        category === value
                          ? 'bg-main-soft text-main'
                          : 'text-ink-sub hover:bg-column',
                      )}
                    >
                      {CATEGORY_LABEL[value]}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <Card title={CATEGORY_LABEL[category]}>
              {(create.isError || update.isError) && (
                <Alert tone="error" className="mb-3">
                  {errorMessageOf(create.error ?? update.error)}
                </Alert>
              )}
              <ul>
                {items.map((option, index) => (
                  <OptionRow
                    key={option.id}
                    option={option}
                    first={index === 0}
                    last={index === items.length - 1}
                    onMove={(direction) => move(index, direction)}
                  />
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <TextInput
                  aria-label="コード"
                  placeholder="コード（英大文字）"
                  className="w-40"
                  value={draft.code}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                    })
                  }
                />
                <TextInput
                  aria-label="名前"
                  placeholder="名前"
                  className="w-56"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                />
                <Button
                  variant="secondary"
                  loading={create.isPending}
                  disabled={!draft.code || !draft.label.trim()}
                  onClick={() =>
                    create.mutate(
                      { category, code: draft.code, label: draft.label.trim() },
                      { onSuccess: () => setDraft({ code: '', label: '' }) },
                    )
                  }
                >
                  追加
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-sub">
                コードは記録に保存される値です。あとから変えられないので、名前だけ変えてください。
              </p>
            </Card>
          </div>
        );
      }}
    </QueryState>
  );
}
