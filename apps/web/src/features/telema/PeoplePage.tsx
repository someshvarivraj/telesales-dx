import { isRole, PREFECTURE_NAMES, type TelemarketerDto } from '@telesales/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { QueryState } from '@/components/ui/QueryState';
import { RoleBadges } from '@/components/ui/RoleBadge';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { TextInput } from '@/components/ui/TextInput';
import { errorMessageOf } from '@/lib/api/errorMessage';
import { timeOptions } from '@/lib/format';
import { useTelemarketers, useUpdateOwnUsualHours, useUpdateTelemarketer } from './api';
import { useTelemaAccess, WEEKDAY_OPTIONS, weekdaysLabel } from './telemaAccess';

const TIMES = [
  { value: '', label: '未設定' },
  ...timeOptions(6, 23).map((time) => ({ value: time, label: time })),
];
const BREAKS = [0, 15, 30, 45, 60, 75, 90, 120].map((minutes) => ({
  value: String(minutes),
  label: `${minutes}分`,
}));

/**
 * Telemarketer info (spec §5, §10: exceptions are data, changed on screen): job type,
 * allocation target or not, fixed territory, and usual hours for filling shifts.
 */
export function PeoplePage() {
  const query = useTelemarketers();
  const { manages, userId, writesShifts } = useTelemaAccess();
  const [editing, setEditing] = useState<TelemarketerDto | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <QueryState query={query}>
        {(people) =>
          people.length === 0 ? (
            <Card>
              <EmptyState>
                テレマの人がいません。管理 ＞ ユーザー・役割 で役割を付けてください。
              </EmptyState>
            </Card>
          ) : (
            <Card flush>
              <Table>
                <thead>
                  <tr>
                    <Th>名前</Th>
                    <Th>職種</Th>
                    <Th>割り振り</Th>
                    <Th>担当範囲</Th>
                    <Th>いつもの勤務</Th>
                    <Th>
                      <span className="sr-only">操作</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.user.id}>
                      <Td>
                        <span className="font-medium">{person.user.name}</span>
                        <span className="mt-1 block">
                          <RoleBadges roles={person.roles.filter(isRole)} />
                        </span>
                      </Td>
                      <Td>{person.jobType ?? '―'}</Td>
                      <Td>
                        {person.isAllocationTarget ? (
                          <Badge tone="calls">対象</Badge>
                        ) : (
                          <Badge tone="outline">対象外</Badge>
                        )}
                      </Td>
                      <Td>{person.territory.length ? person.territory.join('・') : '―'}</Td>
                      <Td className="tabular-nums">
                        {person.usualStart
                          ? `${weekdaysLabel(person.usualWeekdays)} ${person.usualStart}〜${person.usualEnd}（休憩${person.usualBreakMinutes}分）`
                          : '未設定'}
                      </Td>
                      <Td className="text-right">
                        {(manages || (writesShifts && person.user.id === userId)) && (
                          <Button variant="secondary" onClick={() => setEditing(person)}>
                            {manages ? '変更' : 'いつもの勤務を変える'}
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )
        }
      </QueryState>
      <p className="text-sm text-ink-sub">
        「割り振りの対象外」は自動割り振りで配りません（管理担当など）。担当範囲の都道府県の企業は、自動割り振りから外れます。
      </p>
      {editing && (
        <PersonDialog
          key={editing.user.id}
          person={editing}
          full={manages}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PersonDialog({
  person,
  full,
  onClose,
}: {
  person: TelemarketerDto;
  /** Leads and admins edit everything; a telemarketer only their own usual hours. */
  full: boolean;
  onClose: () => void;
}) {
  const updateAll = useUpdateTelemarketer();
  const updateOwn = useUpdateOwnUsualHours();
  const [values, setValues] = useState({
    jobType: person.jobType ?? '',
    isAllocationTarget: person.isAllocationTarget,
    territory: person.territory,
    usualStart: person.usualStart ?? '',
    usualEnd: person.usualEnd ?? '',
    usualBreakMinutes: person.usualBreakMinutes,
    usualWeekdays: person.usualWeekdays,
  });
  const [prefecture, setPrefecture] = useState('');
  const invalid = !!values.usualStart && !!values.usualEnd && values.usualEnd <= values.usualStart;
  const pending = updateAll.isPending || updateOwn.isPending;
  const error = updateAll.error ?? updateOwn.error;

  const save = () => {
    const usual = {
      usualStart: values.usualStart || null,
      usualEnd: values.usualEnd || null,
      usualBreakMinutes: values.usualBreakMinutes,
      usualWeekdays: values.usualWeekdays,
    };
    if (full) {
      updateAll.mutate(
        {
          id: person.user.id,
          request: {
            ...usual,
            jobType: values.jobType.trim() || null,
            isAllocationTarget: values.isAllocationTarget,
            territory: values.territory,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      updateOwn.mutate(usual, { onSuccess: onClose });
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${person.user.name}さんのテレマ情報`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button loading={pending} disabled={invalid} onClick={save}>
            保存する
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{errorMessageOf(error)}</Alert>}
        {full && (
          <>
            <FormField label="職種" hint="例：テレマ、管理担当">
              {(c) => (
                <TextInput
                  {...c}
                  value={values.jobType}
                  maxLength={48}
                  onChange={(e) => setValues({ ...values, jobType: e.target.value })}
                />
              )}
            </FormField>
            <Checkbox
              label="自動割り振りの対象にする"
              checked={values.isAllocationTarget}
              onChange={(e) => setValues({ ...values, isAllocationTarget: e.target.checked })}
            />
            <div>
              <p className="mb-1 text-sm font-bold">担当範囲（決まっている人だけ）</p>
              <div className="flex flex-wrap items-center gap-2">
                {values.territory.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="border border-line px-2 py-1 text-sm hover:border-danger hover:text-danger"
                    onClick={() =>
                      setValues({
                        ...values,
                        territory: values.territory.filter((t) => t !== name),
                      })
                    }
                    aria-label={`${name}を外す`}
                  >
                    {name} ×
                  </button>
                ))}
                <Select
                  aria-label="都道府県を足す"
                  value={prefecture}
                  placeholder="都道府県を足す"
                  options={PREFECTURE_NAMES.filter((name) => !values.territory.includes(name)).map(
                    (name) => ({ value: name, label: name }),
                  )}
                  onChange={(e) => {
                    const name = e.target.value;
                    if (name) setValues({ ...values, territory: [...values.territory, name] });
                    setPrefecture('');
                  }}
                  className="w-48"
                />
              </div>
            </div>
          </>
        )}
        <fieldset>
          <legend className="mb-1 text-sm font-bold">
            いつもの勤務（シフトを埋めるときに使います）
          </legend>
          <div className="mb-3 flex flex-wrap gap-4">
            {WEEKDAY_OPTIONS.map((day) => (
              <Checkbox
                key={day.value}
                label={day.label}
                checked={values.usualWeekdays.includes(day.value)}
                onChange={(e) =>
                  setValues({
                    ...values,
                    usualWeekdays: e.target.checked
                      ? [...values.usualWeekdays, day.value]
                      : values.usualWeekdays.filter((d) => d !== day.value),
                  })
                }
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="開始">
              {(c) => (
                <Select
                  {...c}
                  value={values.usualStart}
                  options={TIMES}
                  onChange={(e) => setValues({ ...values, usualStart: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="終了" error={invalid ? '開始より後にしてください' : undefined}>
              {(c) => (
                <Select
                  {...c}
                  value={values.usualEnd}
                  options={TIMES}
                  onChange={(e) => setValues({ ...values, usualEnd: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="休憩">
              {(c) => (
                <Select
                  {...c}
                  value={String(values.usualBreakMinutes)}
                  options={BREAKS}
                  onChange={(e) =>
                    setValues({ ...values, usualBreakMinutes: Number(e.target.value) })
                  }
                />
              )}
            </FormField>
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
