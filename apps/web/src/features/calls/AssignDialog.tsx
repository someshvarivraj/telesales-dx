import { type AllocationAssignResult, OFFICE_KIND_LABELS, OFFICE_KINDS } from '@telesales/shared';
import { useState } from 'react';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button, LinkButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Spinner } from '@/components/ui/Spinner';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { todayJst } from '@/lib/format';
import { useAllocation, useAssignAllocation } from '@/features/telema/api';

function hoursOf(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

/**
 * 検索結果をテレマに割り振る (answer 11/10 No.5 ②): the companies found go to the people
 * chosen, with 本社・支社・工場・その他 spread evenly. They join the day's draft allocation.
 */
export function AssignDialog({
  companyIds,
  onClose,
}: {
  companyIds: string[];
  onClose: () => void;
}) {
  const today = todayJst();
  const [date, setDate] = useState(today);
  const day = useAllocation(date);
  const assign = useAssignAllocation();
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [result, setResult] = useState<AllocationAssignResult | null>(null);
  const targets = day.data?.date === date ? day.data.targets : [];
  const working = targets.filter((target) => target.workingMinutes > 0);

  // Everyone working that day is ticked until the lead changes it (again for another day).
  const picked = chosen ?? new Set(working.map((target) => target.user.id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    setChosen(next);
  };

  const submit = () =>
    assign.mutate(
      {
        date,
        companyIds,
        assigneeIds: working.map((t) => t.user.id).filter((id) => picked.has(id)),
      },
      { onSuccess: setResult },
    );

  if (result) {
    return (
      <Dialog
        open
        onClose={onClose}
        size="lg"
        title="割り振りました"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              閉じる
            </Button>
            <LinkButton to={`${paths.telemaAllocation}?date=${date}`}>
              割り振りを確認して確定する
            </LinkButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Alert tone="success">
            {`${result.assigned}社を${result.people.length}人に割り振りました。`}
            {result.skipped > 0 && `（架電対象外・重複の${result.skipped}社は割り振っていません）`}
          </Alert>
          <p className="text-sm text-ink-sub">
            まだ下書きです。割り振り画面で確定すると、各テレマに表示されます。
          </p>
          <div className="overflow-x-auto border border-line">
            <table className="w-full border-collapse text-sm whitespace-nowrap">
              <thead className="bg-column">
                <tr>
                  <th className="px-3 py-2 text-left">テレマ</th>
                  <th className="px-3 py-2 text-right">合計</th>
                  {OFFICE_KINDS.map((kind) => (
                    <th key={kind} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      {OFFICE_KIND_LABELS[kind]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.people.map((person) => (
                  <tr key={person.user.id} className="border-t border-line">
                    <td className="px-3 py-2 font-medium" data-no-translate>
                      {person.user.name}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{person.total}</td>
                    {OFFICE_KINDS.map((kind) => (
                      <td key={kind} className="px-3 py-2 text-right tabular-nums">
                        {person.byKind[kind]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>
    );
  }

  const count = working.filter((target) => picked.has(target.user.id)).length;
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`${companyIds.length}社をテレマに割り振る`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={submit} loading={assign.isPending} disabled={count === 0}>
            {count === 0 ? '割り振る' : `${count}人に割り振る`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-sub">
          本社・支社・工場・その他の事業所が、それぞれ偏らないように分けます。その日の割り振り（下書き）に入るので、割り振り画面で確定してください。
        </p>
        {assign.isError && <Alert tone="error">{errorMessageOf(assign.error)}</Alert>}

        <FormField label="架電する日">
          {(c) => (
            <DatePicker
              {...c}
              className="sm:max-w-60"
              value={date}
              min={today}
              onChange={(event) => {
                if (!event.target.value) return;
                setDate(event.target.value);
                setChosen(null);
              }}
            />
          )}
        </FormField>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-bold">割り振るテレマ</legend>
          {day.isLoading || day.data?.date !== date ? (
            <Spinner />
          ) : working.length === 0 ? (
            <Alert tone="warning">
              この日に出勤するテレマがいません。先にシフトを入れてください。
            </Alert>
          ) : (
            <div className="grid gap-x-4 sm:grid-cols-2">
              {working.map((target) => (
                <Checkbox
                  key={target.user.id}
                  checked={picked.has(target.user.id)}
                  onChange={(event) => toggle(target.user.id, event.target.checked)}
                  label={<span data-no-translate>{target.user.name}</span>}
                  description={`出勤 ${hoursOf(target.workingMinutes)}・今の割り振り ${target.calls}件`}
                />
              ))}
            </div>
          )}
        </fieldset>

        <p className="text-xs text-ink-sub">
          割り振り画面で「計算し直す」を押すと、この割り振りは消えて自動の割り振りだけになります。
        </p>
      </div>
    </Dialog>
  );
}
