import {
  type AllocationDayResponse,
  type AllocationItemDto,
  AllocationKind,
  formatSlashDate,
} from '@telesales/shared';
import { CheckCheck, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { ApiError } from '@/lib/api/ApiError';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { formatDate, formatDateTime, todayJst } from '@/lib/format';
import {
  useAllocation,
  useCalculateAllocation,
  useConfirmAllocation,
  useMoveAllocation,
} from './api';
import { formatMinutes, useTelemaAccess } from './telemaAccess';

const SHOWN = 300;

const STATE_LABEL = {
  NONE: { label: 'まだありません', tone: 'outline' },
  DRAFT: { label: '案（未確定）', tone: 'warning' },
  CONFIRMED: { label: '確定済み', tone: 'success' },
} as const;

function calculateError(error: unknown): string {
  if (ApiError.isApiError(error) && error.code === 'INVALID_STATE') {
    const reason = (error.details as { reason?: string } | undefined)?.reason;
    if (reason === 'nobody_working') {
      return '割り振りの対象で出勤の人がいません。シフトとテレマ情報を確かめてください。';
    }
    if (reason === 'not_business_day') {
      return '休日は割り振りません。';
    }
  }
  return errorMessageOf(error);
}

/**
 * Auto allocation (spec §7, priority 2). The morning run makes a draft; the lead moves
 * items between people if needed and confirms. Everyone sees their part after that.
 */
export function AllocationPage() {
  const [date, setDate] = useState(todayJst());
  const query = useAllocation(date);
  const { manages } = useTelemaAccess();
  const calculate = useCalculateAllocation();
  const confirm = useConfirmAllocation();
  const [recalculating, setRecalculating] = useState(false);

  const run = () => calculate.mutate(date, { onSettled: () => setRecalculating(false) });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          日付
          <DatePicker
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-48"
          />
        </label>
        {manages && query.data && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" aria-hidden="true" />}
              loading={calculate.isPending}
              disabled={!query.data.businessDay}
              onClick={() => (query.data.state === 'NONE' ? run() : setRecalculating(true))}
            >
              {query.data.state === 'NONE' ? '割り振りを計算する' : '計算し直す'}
            </Button>
            <Button
              icon={<CheckCheck className="size-4" aria-hidden="true" />}
              loading={confirm.isPending}
              disabled={query.data.state !== 'DRAFT'}
              onClick={() => confirm.mutate(date)}
            >
              確定して各自に知らせる
            </Button>
          </div>
        )}
      </div>
      {calculate.isError && <Alert tone="error">{calculateError(calculate.error)}</Alert>}
      {calculate.isSuccess && (
        <Alert tone="success">
          架電 {calculate.data.calls}件・前日確認 {calculate.data.dayBefore}
          件を割り振りました。確かめて「確定」を押してください。
        </Alert>
      )}
      {confirm.isError && <Alert tone="error">{errorMessageOf(confirm.error)}</Alert>}
      {confirm.isSuccess && (
        <Alert tone="success">確定しました。各自にお知らせしました（N11）。</Alert>
      )}

      <QueryState query={query}>
        {(data) => <AllocationDay data={data} manages={manages} />}
      </QueryState>

      <Dialog
        open={recalculating}
        onClose={() => setRecalculating(false)}
        title="計算し直しますか？"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecalculating(false)}>
              キャンセル
            </Button>
            <Button loading={calculate.isPending} onClick={run}>
              計算し直す
            </Button>
          </>
        }
      >
        <p>
          今のシフトと架電対象で作り直します。手で動かした分
          {query.data?.state === 'CONFIRMED' && 'と確定'}
          は消え、もう一度確定が必要になります。
        </p>
      </Dialog>
    </div>
  );
}

function AllocationDay({ data, manages }: { data: AllocationDayResponse; manages: boolean }) {
  const state = STATE_LABEL[data.state];
  const hidden = !manages && data.state !== 'CONFIRMED';
  return (
    <>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {formatDate(data.date)} の割り振り
            <Badge tone={state.tone}>{state.label}</Badge>
          </span>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          {!data.businessDay && <p>休日です。</p>}
          {data.confirmedAt && (
            <p className="text-ink-sub">
              {formatDateTime(data.confirmedAt)} に {data.confirmedBy?.name} さんが確定
            </p>
          )}
          <p className="text-ink-sub">
            出勤している「割り振りの対象」の人に、稼働時間の割合で配ります（忙しさは見ません）。同じ会社名の企業は同じ人に。前日確認（
            {data.dayBeforeDates.map((date) => formatSlashDate(date).slice(5)).join('・')}
            のアポ）は、取った本人が出勤していれば本人に。
            {data.fixedTerritory.length > 0 &&
              ` 担当範囲が決まっている ${data.fixedTerritory.join('・')} の企業は外します。`}
          </p>
          {hidden ? (
            <p>リーダーが確定すると、ここに出ます。</p>
          ) : data.targets.length === 0 ? (
            <p>
              割り振りの対象で出勤の人がいません。
              <Link to={paths.telemaShifts} className="ml-1 font-bold text-link hover:underline">
                シフトを見る
              </Link>
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>名前</Th>
                  <Th className="text-right">稼働</Th>
                  <Th className="text-right">割合</Th>
                  <Th className="text-right">架電</Th>
                  <Th className="text-right">前日確認</Th>
                </tr>
              </thead>
              <tbody>
                {data.targets.map((target) => (
                  <tr key={target.user.id}>
                    <Td className="font-medium">{target.user.name}</Td>
                    <Td className="text-right tabular-nums">
                      {target.workingMinutes > 0 ? formatMinutes(target.workingMinutes) : '―'}
                    </Td>
                    <Td className="text-right tabular-nums">{(target.share * 100).toFixed(0)}%</Td>
                    <Td className="text-right tabular-nums">{target.calls}</Td>
                    <Td className="text-right tabular-nums">{target.dayBefore}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
      {!hidden && data.items.length > 0 && (
        <>
          <ItemList
            title="架電リスト"
            date={data.date}
            items={data.items.filter((item) => item.kind === AllocationKind.Call)}
            people={data.targets.map((target) => target.user)}
            manages={manages}
          />
          <ItemList
            title="前日確認"
            date={data.date}
            items={data.items.filter((item) => item.kind === AllocationKind.DayBefore)}
            people={data.targets.map((target) => target.user)}
            manages={manages}
          />
        </>
      )}
    </>
  );
}

interface ItemListProps {
  title: string;
  date: string;
  items: AllocationItemDto[];
  people: { id: string; name: string }[];
  manages: boolean;
}

function ItemList({ title, date, items, people, manages }: ItemListProps) {
  const { userId } = useTelemaAccess();
  const move = useMoveAllocation();
  const [filter, setFilter] = useState(manages ? '' : userId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState('');
  const visible = items.filter((item) => !filter || item.assignee.id === filter);
  const shown = visible.slice(0, SHOWN);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card
      title={`${title}（${items.length}件）`}
      actions={
        <Select
          aria-label="担当で絞る"
          value={filter}
          options={[
            { value: '', label: 'すべての担当' },
            ...people.map((person) => ({ value: person.id, label: person.name })),
          ]}
          onChange={(e) => {
            setFilter(e.target.value);
            setSelected(new Set());
          }}
        />
      }
      flush
    >
      {manages && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-sm">
          <span>選んだ {selected.size} 件を</span>
          <Select
            aria-label="新しい担当"
            value={target}
            placeholder="担当を選ぶ"
            options={people.map((person) => ({ value: person.id, label: person.name }))}
            onChange={(e) => setTarget(e.target.value)}
            className="w-44"
          />
          <Button
            variant="secondary"
            disabled={selected.size === 0 || !target}
            loading={move.isPending}
            onClick={() =>
              move.mutate(
                { date, ids: [...selected], assigneeId: target },
                { onSuccess: () => setSelected(new Set()) },
              )
            }
          >
            に渡す
          </Button>
          {move.isError && <span className="text-danger">{errorMessageOf(move.error)}</span>}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState mood="done">ありません。</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              {manages && (
                <Th className="w-10">
                  <Checkbox
                    label={<span className="sr-only">表示中をすべて選ぶ</span>}
                    checked={shown.length > 0 && shown.every((item) => selected.has(item.id))}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(shown.map((item) => item.id)) : new Set(),
                      )
                    }
                  />
                </Th>
              )}
              <Th>{title === '前日確認' ? 'アポ' : '企業'}</Th>
              <Th>{title === '前日確認' ? '日時・担当営業' : '地域・リスト'}</Th>
              <Th>担当</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr key={item.id}>
                {manages && (
                  <Td>
                    <Checkbox
                      label={<span className="sr-only">選ぶ</span>}
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                  </Td>
                )}
                <Td>
                  {item.company && (
                    <Link
                      to={paths.company(item.company.id)}
                      className="font-medium text-link hover:underline"
                    >
                      {item.company.name}
                    </Link>
                  )}
                  {item.appointment && (
                    <Link
                      to={paths.appointment(item.appointment.id)}
                      className="font-medium text-link hover:underline"
                    >
                      {item.appointment.companyName}
                    </Link>
                  )}
                </Td>
                <Td className="text-ink-sub">
                  {item.company &&
                    [item.company.prefecture, item.company.city, item.company.listName]
                      .filter(Boolean)
                      .join(' ')}
                  {item.appointment &&
                    `${formatDateTime(item.appointment.startsAt)}・${item.appointment.salesRep.name}（取得 ${item.appointment.bookedBy.name}）`}
                </Td>
                <Td>{item.assignee.name}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {visible.length > SHOWN && (
        <p className="px-5 py-3 text-sm text-ink-sub">
          最初の {SHOWN} 件を表示しています（全 {visible.length}{' '}
          件）。担当で絞ると見やすくなります。
        </p>
      )}
    </Card>
  );
}
